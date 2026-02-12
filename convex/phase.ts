import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPhaseStatus = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query("phaseState")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		if (!state) {
			return {
				currentPhase: "coding",
				model: null,
				lastSwap: 0,
				ramPercent: null,
				queuedCoding: 0,
				queuedReasoning: 0,
			};
		}

		return state;
	},
});

export const updatePhaseState = mutation({
	args: {
		tenantId: v.string(),
		currentPhase: v.string(),
		model: v.optional(v.string()),
		ramPercent: v.optional(v.number()),
		queuedCoding: v.optional(v.number()),
		queuedReasoning: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("phaseState")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		const now = Date.now();

		if (existing) {
			// Record swap history if phase changed
			if (existing.currentPhase !== args.currentPhase) {
				await ctx.db.insert("phaseSwapHistory", {
					fromPhase: existing.currentPhase,
					toPhase: args.currentPhase,
					timestamp: now,
					trigger: "api",
					codingQueuedAtSwap: existing.queuedCoding,
					reasoningQueuedAtSwap: existing.queuedReasoning,
					durationMs: now - existing.lastSwap,
					tenantId: args.tenantId,
				});
			}

			await ctx.db.patch(existing._id, {
				currentPhase: args.currentPhase,
				model: args.model,
				lastSwap: now,
				ramPercent: args.ramPercent,
				queuedCoding: args.queuedCoding,
				queuedReasoning: args.queuedReasoning,
			});
		} else {
			await ctx.db.insert("phaseState", {
				currentPhase: args.currentPhase,
				model: args.model,
				lastSwap: now,
				ramPercent: args.ramPercent,
				queuedCoding: args.queuedCoding,
				queuedReasoning: args.queuedReasoning,
				tenantId: args.tenantId,
			});
		}
	},
});

export const getSwapHistory = query({
	args: {
		tenantId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("phaseSwapHistory")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.take(args.limit || 20);
	},
});

export const recordSwap = mutation({
	args: {
		tenantId: v.string(),
		fromPhase: v.string(),
		toPhase: v.string(),
		trigger: v.optional(v.string()),
		codingQueuedAtSwap: v.optional(v.number()),
		reasoningQueuedAtSwap: v.optional(v.number()),
		durationMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("phaseSwapHistory", {
			...args,
			timestamp: Date.now(),
		});
	},
});
