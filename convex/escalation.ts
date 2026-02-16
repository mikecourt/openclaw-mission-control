import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// --- Orchestration Event Logging ---

export const logOrchestrationEvent = mutation({
	args: {
		tenantId: v.string(),
		taskId: v.id("tasks"),
		agentName: v.string(),
		eventType: v.string(), // qa_gate | retry | escalate | handoff | dispatch | blocked
		decision: v.optional(v.string()), // accept | retry | escalate (for qa_gate)
		fromAgent: v.optional(v.string()),
		toAgent: v.optional(v.string()),
		reason: v.optional(v.string()),
		feedback: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const task = await ctx.db.get(args.taskId);
		if (!task || task.tenantId !== args.tenantId) {
			throw new Error("Task not found");
		}

		// Build escalation history entry
		const historyEntry = {
			agentId: args.agentName,
			timestamp: Date.now(),
			status: args.eventType,
			reason: buildReason(args),
		};

		const escalationHistory = [...(task.escalationHistory || []), historyEntry];

		// Build task patch
		const patch: Record<string, unknown> = { escalationHistory };
		if (args.eventType === "escalate") {
			patch.escalationAttempts = (task.escalationAttempts || 0) + 1;
		}

		await ctx.db.patch(args.taskId, patch);

		// Build human-readable message
		const message = buildMessage(args, task.title);

		// Insert into activityLog
		await ctx.db.insert("activityLog", {
			tenantId: args.tenantId,
			timestamp: Date.now(),
			level: args.eventType === "escalate" ? "warn" : "info",
			source: args.agentName,
			action: `orchestration:${args.eventType}`,
			message,
			taskId: args.taskId,
			metadata: {
				decision: args.decision,
				fromAgent: args.fromAgent,
				toAgent: args.toAgent,
				feedback: args.feedback,
				...(args.metadata || {}),
			},
		});

		// Insert into activities table (need agent doc for the ID)
		const agent = await ctx.db
			.query("agents")
			.withIndex("by_tenant_name", (q) =>
				q.eq("tenantId", args.tenantId).eq("name", args.agentName)
			)
			.first();

		if (agent) {
			await ctx.db.insert("activities", {
				type: "orchestration",
				agentId: agent._id,
				message,
				targetId: args.taskId,
				tenantId: args.tenantId,
			});
		}
	},
});

function buildReason(args: {
	eventType: string;
	decision?: string;
	fromAgent?: string;
	toAgent?: string;
	reason?: string;
	feedback?: string;
}): string {
	const parts: string[] = [];

	if (args.decision) parts.push(`decision: ${args.decision}`);
	if (args.fromAgent && args.toAgent) {
		parts.push(`${args.fromAgent} → ${args.toAgent}`);
	} else if (args.toAgent) {
		parts.push(`→ ${args.toAgent}`);
	}
	if (args.reason) parts.push(args.reason);
	if (args.feedback) parts.push(`feedback: ${args.feedback}`);

	return parts.join(" | ") || args.eventType;
}

function buildMessage(
	args: {
		eventType: string;
		agentName: string;
		decision?: string;
		fromAgent?: string;
		toAgent?: string;
		reason?: string;
		feedback?: string;
	},
	taskTitle: string,
): string {
	switch (args.eventType) {
		case "qa_gate":
			return `QA gate on "${taskTitle}": ${args.decision || "reviewed"}${args.reason ? ` — ${args.reason}` : ""}`;
		case "retry":
			return `Retry "${taskTitle}"${args.toAgent ? ` → ${args.toAgent}` : ""}${args.feedback ? `: ${args.feedback}` : ""}`;
		case "escalate":
			return `Escalated "${taskTitle}"${args.fromAgent ? ` from ${args.fromAgent}` : ""}${args.toAgent ? ` → ${args.toAgent}` : ""}${args.reason ? ` — ${args.reason}` : ""}`;
		case "handoff":
			return `Handoff "${taskTitle}"${args.fromAgent ? ` from ${args.fromAgent}` : ""}${args.toAgent ? ` → ${args.toAgent}` : ""}${args.reason ? ` — ${args.reason}` : ""}`;
		case "dispatch":
			return `Dispatched "${taskTitle}"${args.toAgent ? ` → ${args.toAgent}` : ""}${args.reason ? ` — ${args.reason}` : ""}`;
		case "blocked":
			return `Blocked "${taskTitle}"${args.reason ? `: ${args.reason}` : ""}`;
		default:
			return `${args.eventType} on "${taskTitle}"`;
	}
}

// --- Orchestration Metrics ---

export const getOrchestrationMetrics = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		// Query activityLog for orchestration events today
		const logs = await ctx.db
			.query("activityLog")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const orchestrationLogs = logs.filter(
			(l) => l.action.startsWith("orchestration:") && l.timestamp >= todayMs
		);

		// Count by event type
		const counts: Record<string, number> = {};
		for (const log of orchestrationLogs) {
			const eventType = log.action.replace("orchestration:", "");
			counts[eventType] = (counts[eventType] || 0) + 1;
		}

		// QA gate pass rate
		const qaGateTotal = counts["qa_gate"] || 0;
		const qaAccepted = orchestrationLogs.filter(
			(l) =>
				l.action === "orchestration:qa_gate" &&
				l.metadata?.decision === "accept"
		).length;
		const passRate = qaGateTotal > 0 ? Math.round((qaAccepted / qaGateTotal) * 100) : null;

		// Tasks currently escalated
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const escalatedTasks = tasks.filter(
			(t) =>
				(t.escalationAttempts ?? 0) > 0 &&
				(t.status === "in_progress" || t.status === "review")
		).length;

		return {
			qaGates: qaGateTotal,
			retries: counts["retry"] || 0,
			escalations: counts["escalate"] || 0,
			handoffs: counts["handoff"] || 0,
			dispatches: counts["dispatch"] || 0,
			passRate,
			escalatedTasks,
		};
	},
});

// --- Task Escalation Timeline ---

export const getTaskEscalationTimeline = query({
	args: {
		tenantId: v.string(),
		taskId: v.id("tasks"),
	},
	handler: async (ctx, args) => {
		const task = await ctx.db.get(args.taskId);
		if (!task || task.tenantId !== args.tenantId) {
			throw new Error("Task not found");
		}
		return task.escalationHistory || [];
	},
});
