import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAgentMetrics = query({
	args: {
		tenantId: v.string(),
		agentId: v.string(),
		days: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const metrics = await ctx.db
			.query("agentMetrics")
			.withIndex("by_tenant_agent", (q) =>
				q.eq("tenantId", args.tenantId).eq("agentId", args.agentId)
			)
			.order("desc")
			.take(args.days || 7);

		return metrics.reverse(); // chronological order
	},
});

export const recordDailyMetrics = mutation({
	args: {
		tenantId: v.string(),
		agentId: v.string(),
		date: v.string(),
		tasksCompleted: v.number(),
		tasksFailed: v.number(),
		tasksEscalated: v.number(),
		avgCompletionMs: v.optional(v.number()),
		tokensUsed: v.optional(v.number()),
		estimatedCost: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Upsert by agent + date
		const existing = await ctx.db
			.query("agentMetrics")
			.withIndex("by_tenant_agent", (q) =>
				q.eq("tenantId", args.tenantId).eq("agentId", args.agentId)
			)
			.filter((q) => q.eq(q.field("date"), args.date))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				tasksCompleted: args.tasksCompleted,
				tasksFailed: args.tasksFailed,
				tasksEscalated: args.tasksEscalated,
				avgCompletionMs: args.avgCompletionMs,
				tokensUsed: args.tokensUsed,
				estimatedCost: args.estimatedCost,
			});
		} else {
			await ctx.db.insert("agentMetrics", {
				...args,
			});
		}
	},
});

export const getDashboardMetrics = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const today = new Date().toISOString().split("T")[0];
		const todayMetrics = await ctx.db
			.query("agentMetrics")
			.withIndex("by_tenant_date", (q) =>
				q.eq("tenantId", args.tenantId).eq("date", today)
			)
			.collect();

		let totalCompleted = 0;
		let totalFailed = 0;
		let totalEscalated = 0;
		let totalCost = 0;

		for (const m of todayMetrics) {
			totalCompleted += m.tasksCompleted;
			totalFailed += m.tasksFailed;
			totalEscalated += m.tasksEscalated;
			totalCost += m.estimatedCost || 0;
		}

		return {
			today: { totalCompleted, totalFailed, totalEscalated, totalCost },
			byAgent: todayMetrics,
		};
	},
});
