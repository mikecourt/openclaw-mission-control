import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
	args: {
		tenantId: v.string(),
		timestamp: v.number(),
		level: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("debug")),
		source: v.string(),
		action: v.string(),
		message: v.string(),
		metadata: v.optional(v.any()),
		taskId: v.optional(v.id("tasks")),
		agentId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("activityLog", {
			...args,
		});
	},
});

export const getActivityLog = query({
	args: {
		tenantId: v.string(),
		level: v.optional(v.string()),
		source: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;

		let q = ctx.db
			.query("activityLog")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc");

		const logs = await q.take(limit);

		// Apply filters in-memory (Convex doesn't support compound dynamic filters well)
		let filtered = logs;
		if (args.level) {
			filtered = filtered.filter((l) => l.level === args.level);
		}
		if (args.source) {
			filtered = filtered.filter((l) => l.source === args.source);
		}

		return filtered;
	},
});

export const getRecentLog = query({
	args: {
		tenantId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("activityLog")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.take(args.limit || 20);
	},
});
