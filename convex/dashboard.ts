import { query } from "./_generated/server";
import { v } from "convex/values";

/** How recently lastActiveAt must be to count as "active". */
const RUNNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function getEffectiveStatus(
	agent: { status: string; isEnabled?: boolean; lastActiveAt?: number; _id: string },
	tasks: Array<{ assigneeIds: string[]; status: string; blockedBy?: string; needsInput?: boolean }>,
	now: number,
): "active" | "idle" | "off" | "blocked" {
	// 1. Disabled
	if (agent.isEnabled === false || agent.status === "off") return "off";

	// 2. Running — recent heartbeat / session activity
	if (agent.lastActiveAt && now - agent.lastActiveAt < RUNNING_THRESHOLD_MS) return "active";

	// 3. Blocked — has open tasks but every one is blocked
	const assignedTasks = tasks.filter(
		(t) =>
			t.assigneeIds.includes(agent._id) &&
			t.status !== "done" &&
			t.status !== "archived" &&
			t.status !== "inbox",
	);
	if (assignedTasks.length > 0) {
		const allBlocked = assignedTasks.every((t) => !!t.blockedBy || !!t.needsInput);
		if (allBlocked) return "blocked";
	}

	// 4. Not running
	return "idle";
}

export const getSystemOverview = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const now = Date.now();
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		// Use computed effective status
		const activeAgents = agents.filter((a) => getEffectiveStatus(a, tasks, now) === "active").length;
		const idleAgents = agents.filter((a) => getEffectiveStatus(a, tasks, now) === "idle").length;
		const offAgents = agents.filter((a) => getEffectiveStatus(a, tasks, now) === "off").length;

		const activeTasks = tasks.filter((t) => t.status === "in_progress").length;
		const queuedTasks = tasks.filter((t) => t.status === "inbox" || t.status === "assigned").length;
		const completedToday = tasks.filter(
			(t) => (t.status === "done" || t.status === "archived") && t._creationTime >= todayMs
		).length;
		const failedToday = tasks.filter(
			(t) => t.status === "review" && t.needsInput && t._creationTime >= todayMs
		).length;
		const reviewTasks = tasks.filter((t) => t.status === "review").length;

		return {
			agents: { active: activeAgents, idle: idleAgents, off: offAgents, total: agents.length },
			tasks: { active: activeTasks, queued: queuedTasks, completedToday, failedToday, review: reviewTasks },
			alertCount: reviewTasks,
		};
	},
});

export const getTaskThroughput = query({
	args: {
		tenantId: v.string(),
		hours: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const hours = args.hours || 24;
		const now = Date.now();
		const cutoff = now - hours * 60 * 60 * 1000;

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const recentDone = tasks.filter(
			(t) => (t.status === "done" || t.status === "archived") && t._creationTime >= cutoff
		);

		// Bucket by hour
		const buckets: Record<string, number> = {};
		for (let i = 0; i < hours; i++) {
			const hourStart = now - (hours - i) * 60 * 60 * 1000;
			const hourEnd = hourStart + 60 * 60 * 1000;
			const key = new Date(hourStart).toISOString().slice(0, 13);
			buckets[key] = recentDone.filter(
				(t) => t._creationTime >= hourStart && t._creationTime < hourEnd
			).length;
		}

		return Object.entries(buckets).map(([hour, count]) => ({
			hour,
			count,
		}));
	},
});

export const getBusinessSplit = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const activeTasks = tasks.filter(
			(t) => t.status !== "done" && t.status !== "archived"
		);

		const byBusiness: Record<string, number> = {};
		for (const task of activeTasks) {
			const bu = (task as any).businessUnit || "unassigned";
			byBusiness[bu] = (byBusiness[bu] || 0) + 1;
		}

		return Object.entries(byBusiness).map(([name, count]) => ({ name, count }));
	},
});

export const getUsageByModel = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const usage = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const byModel: Record<string, { cost: number; tokens: number; calls: number }> = {};
		for (const record of usage) {
			if (!byModel[record.model]) {
				byModel[record.model] = { cost: 0, tokens: 0, calls: 0 };
			}
			byModel[record.model].cost += record.cost;
			byModel[record.model].tokens += record.inputTokens + record.outputTokens;
			byModel[record.model].calls += 1;
		}

		return Object.entries(byModel)
			.map(([model, stats]) => ({ model, ...stats }))
			.sort((a, b) => b.cost - a.cost);
	},
});

export const getCostOverTime = query({
	args: {
		tenantId: v.string(),
		hours: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const hours = args.hours || 24;
		const now = Date.now();
		const cutoff = now - hours * 60 * 60 * 1000;

		const usage = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const recent = usage.filter((u) => u._creationTime >= cutoff);

		// Bucket by hour
		const buckets: Record<string, { cost: number; tokens: number }> = {};
		for (let i = 0; i < hours; i++) {
			const hourStart = now - (hours - i) * 60 * 60 * 1000;
			const hourEnd = hourStart + 60 * 60 * 1000;
			const key = new Date(hourStart).toISOString().slice(0, 13);

			const hourRecords = recent.filter(
				(u) => u._creationTime >= hourStart && u._creationTime < hourEnd
			);

			buckets[key] = {
				cost: hourRecords.reduce((sum, u) => sum + u.cost, 0),
				tokens: hourRecords.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0),
			};
		}

		return Object.entries(buckets).map(([hour, stats]) => ({
			hour,
			...stats,
		}));
	},
});
