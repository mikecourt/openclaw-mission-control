import { query } from "./_generated/server";
import { v } from "convex/values";

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

		const activeAgents = agents.filter((a) => a.status === "active").length;
		const idleAgents = agents.filter((a) => a.status === "idle").length;
		const offAgents = agents.filter((a) => a.status === "off").length;

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
