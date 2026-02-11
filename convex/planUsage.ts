import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
	args: {
		tenantId: v.string(),
		planName: v.string(),
		sessionPct: v.number(),
		sessionResetAt: v.optional(v.string()),
		weeklyPct: v.number(),
		weeklyResetAt: v.optional(v.string()),
		fetchedAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("planUsageSnapshot")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				planName: args.planName,
				sessionPct: args.sessionPct,
				sessionResetAt: args.sessionResetAt,
				weeklyPct: args.weeklyPct,
				weeklyResetAt: args.weeklyResetAt,
				fetchedAt: args.fetchedAt,
			});
		} else {
			await ctx.db.insert("planUsageSnapshot", args);
		}
	},
});
