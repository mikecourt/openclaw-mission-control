import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

type SignalType = "repeated_failures" | "stale_task" | "autonomy_spike" | "budget_burn_spike";
type Severity = "low" | "medium" | "high" | "critical";

// ── analyzeRisks ────────────────────────────────────────────────────────────
// Scans recent data across tables and creates risk signals for anomalies.

export const analyzeRisks = mutation({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const { tenantId } = args;
		const now = Date.now();
		const created: string[] = [];

		// Helper: insert signal and fire webhook for high/critical
		async function createSignal(signal: {
			signalType: SignalType;
			severity: Severity;
			agentId?: string;
			taskId?: any;
			message: string;
			metadata?: any;
		}) {
			await ctx.db.insert("riskSignals", { ...signal, tenantId });
			if (signal.severity === "high" || signal.severity === "critical") {
				await ctx.scheduler.runAfter(0, api.webhooks.deliverWebhookEvent, {
					tenantId,
					event: "risk_signal",
					payload: {
						signalType: signal.signalType,
						severity: signal.severity,
						message: signal.message,
						agentId: signal.agentId,
					},
				});
			}
		}

		// Fetch existing unresolved signals once for dedup checks
		const existingSignals = await ctx.db
			.query("riskSignals")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		const unresolvedSignals = existingSignals.filter((s) => s.resolvedAt === undefined);

		function hasDuplicate(
			signalType: SignalType,
			agentId?: string,
			taskId?: string,
		): boolean {
			return unresolvedSignals.some(
				(s) =>
					s.signalType === signalType &&
					s.agentId === agentId &&
					(taskId ? s.taskId === taskId : s.taskId === undefined),
			);
		}

		// ── 1. Repeated failures ──────────────────────────────────────────────
		// Agents with 3+ recent tasks ending in review+needsInput in last 24h.

		const recentTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const cutoff24h = now - 24 * 60 * 60 * 1000;
		const recentReviewTasks = recentTasks.filter(
			(t) =>
				t.status === "review" &&
				t.needsInput === true &&
				(t.completedAt ?? t._creationTime) >= cutoff24h,
		);

		// Group by agent — use escalationHistory's last agentId, fall back to assigneeIds
		const failuresByAgent: Record<string, number> = {};
		for (const task of recentReviewTasks) {
			const agentIds: string[] = [];
			if (task.escalationHistory && task.escalationHistory.length > 0) {
				agentIds.push(task.escalationHistory[task.escalationHistory.length - 1].agentId);
			} else {
				for (const id of task.assigneeIds) {
					agentIds.push(id as string);
				}
			}
			for (const agentId of agentIds) {
				failuresByAgent[agentId] = (failuresByAgent[agentId] || 0) + 1;
			}
		}

		for (const [agentId, count] of Object.entries(failuresByAgent)) {
			if (count >= 3 && !hasDuplicate("repeated_failures", agentId)) {
				await createSignal({
					signalType: "repeated_failures",
					severity: "high",
					agentId,
					message: `Agent has ${count} tasks requiring review in the last 24h`,
					metadata: { failureCount: count },
				});
				created.push(`repeated_failures:${agentId}`);
			}
		}

		// ── 2. Stale tasks ────────────────────────────────────────────────────
		// Tasks in_progress for > 4h. Critical if > 8h.

		const staleCutoff4h = now - 4 * 60 * 60 * 1000;
		const staleCutoff8h = now - 8 * 60 * 60 * 1000;

		const inProgressTasks = recentTasks.filter(
			(t) => t.status === "in_progress" && t.startedAt !== undefined,
		);

		for (const task of inProgressTasks) {
			if (task.startedAt! > staleCutoff4h) continue;

			const taskIdStr = task._id as string;
			if (hasDuplicate("stale_task", undefined, taskIdStr)) continue;

			const severity: Severity = task.startedAt! <= staleCutoff8h ? "critical" : "high";
			const staleDurationH = Math.round((now - task.startedAt!) / (60 * 60 * 1000));

			await createSignal({
				signalType: "stale_task",
				severity,
				taskId: task._id,
				message: `Task "${task.title}" has been in_progress for ${staleDurationH}h`,
				metadata: { startedAt: task.startedAt, durationHours: staleDurationH },
			});
			created.push(`stale_task:${task._id}`);
		}

		// ── 3. Autonomy spikes ────────────────────────────────────────────────
		// Agent completed 10+ tasks in last 6h with zero going to review.

		const cutoff6h = now - 6 * 60 * 60 * 1000;
		const recent6hTasks = recentTasks.filter(
			(t) => (t.completedAt ?? t._creationTime) >= cutoff6h,
		);

		// Group completed tasks by agent
		const completedByAgent: Record<string, { done: number; reviewed: number }> = {};
		for (const task of recent6hTasks) {
			const agentIds: string[] = [];
			if (task.escalationHistory && task.escalationHistory.length > 0) {
				agentIds.push(task.escalationHistory[task.escalationHistory.length - 1].agentId);
			} else {
				for (const id of task.assigneeIds) {
					agentIds.push(id as string);
				}
			}
			for (const agentId of agentIds) {
				if (!completedByAgent[agentId]) {
					completedByAgent[agentId] = { done: 0, reviewed: 0 };
				}
				if (task.status === "done") {
					completedByAgent[agentId].done++;
				} else if (task.status === "review") {
					completedByAgent[agentId].reviewed++;
				}
			}
		}

		for (const [agentId, stats] of Object.entries(completedByAgent)) {
			if (stats.done >= 10 && stats.reviewed === 0 && !hasDuplicate("autonomy_spike", agentId)) {
				await createSignal({
					signalType: "autonomy_spike",
					severity: "medium",
					agentId,
					message: `Agent completed ${stats.done} tasks in 6h with no review — possible autonomy spike`,
					metadata: { completedCount: stats.done, reviewedCount: 0, windowHours: 6 },
				});
				created.push(`autonomy_spike:${agentId}`);
			}
		}

		// ── 4. Budget burn spikes ─────────────────────────────────────────────
		// Current hour cost > 2x the 24h rolling hourly average.

		const usageRecords = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const recentUsage = usageRecords.filter((u) => u._creationTime >= cutoff24h);

		if (recentUsage.length > 0) {
			const currentHourStart = now - 60 * 60 * 1000;
			const currentHourCost = recentUsage
				.filter((u) => u._creationTime >= currentHourStart)
				.reduce((sum, u) => sum + u.cost, 0);

			// Rolling 24h average (excluding current hour)
			const olderUsage = recentUsage.filter((u) => u._creationTime < currentHourStart);
			const hoursWithData = Math.max(1, 23); // 23 older hours in the window
			const avgHourlyCost = olderUsage.reduce((sum, u) => sum + u.cost, 0) / hoursWithData;

			if (avgHourlyCost > 0 && currentHourCost > 2 * avgHourlyCost) {
				if (!hasDuplicate("budget_burn_spike")) {
					const severity: Severity = currentHourCost > 3 * avgHourlyCost ? "critical" : "high";
					const ratio = Math.round((currentHourCost / avgHourlyCost) * 10) / 10;

					await createSignal({
						signalType: "budget_burn_spike",
						severity,
						message: `Current hour cost ($${currentHourCost.toFixed(2)}) is ${ratio}x the 24h hourly average ($${avgHourlyCost.toFixed(2)})`,
						metadata: {
							currentHourCost,
							avgHourlyCost,
							ratio,
						},
					});
					created.push("budget_burn_spike");
				}
			}
		}

		return { created, count: created.length };
	},
});

// ── getActiveSignals ────────────────────────────────────────────────────────

export const getActiveSignals = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const signals = await ctx.db
			.query("riskSignals")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.collect();

		return signals
			.filter((s) => s.resolvedAt === undefined)
			.slice(0, 50);
	},
});

// ── resolveSignal ───────────────────────────────────────────────────────────

export const resolveSignal = mutation({
	args: {
		tenantId: v.string(),
		signalId: v.id("riskSignals"),
	},
	handler: async (ctx, args) => {
		const signal = await ctx.db.get(args.signalId);
		if (!signal || signal.tenantId !== args.tenantId) {
			throw new Error("Signal not found");
		}
		await ctx.db.patch(args.signalId, { resolvedAt: Date.now() });
	},
});

// ── getSignalCounts ─────────────────────────────────────────────────────────

export const getSignalCounts = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const signals = await ctx.db
			.query("riskSignals")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const active = signals.filter((s) => s.resolvedAt === undefined);

		const counts = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
		for (const signal of active) {
			counts.total++;
			counts[signal.severity]++;
		}

		return counts;
	},
});
