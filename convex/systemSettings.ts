import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSetting = query({
	args: {
		tenantId: v.string(),
		key: v.string(),
	},
	handler: async (ctx, args) => {
		const setting = await ctx.db
			.query("systemSettings")
			.withIndex("by_tenant_key", (q) =>
				q.eq("tenantId", args.tenantId).eq("key", args.key)
			)
			.first();
		return setting?.value ?? null;
	},
});

export const setSetting = mutation({
	args: {
		tenantId: v.string(),
		key: v.string(),
		value: v.any(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("systemSettings")
			.withIndex("by_tenant_key", (q) =>
				q.eq("tenantId", args.tenantId).eq("key", args.key)
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				value: args.value,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("systemSettings", {
				key: args.key,
				value: args.value,
				updatedAt: Date.now(),
				tenantId: args.tenantId,
			});
		}
	},
});

export const getAllSettings = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("systemSettings")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();
	},
});

export const purgeOldTasks = mutation({
	args: {
		tenantId: v.string(),
		olderThanDays: v.number(),
	},
	handler: async (ctx, args) => {
		const cutoff = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		let purged = 0;
		for (const task of tasks) {
			if (
				(task.status === "done" || task.status === "archived") &&
				task._creationTime < cutoff
			) {
				await ctx.db.delete(task._id);
				purged++;
			}
		}
		return { purged };
	},
});
