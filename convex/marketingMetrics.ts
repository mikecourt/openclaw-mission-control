import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get marketing metrics by period
export const getMetricsByPeriod = query({
	args: {
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		startMonth: v.string(), // YYYY-MM
		endMonth: v.string(), // YYYY-MM
	},
	handler: async (ctx, args) => {
		const metrics = await ctx.db
			.query("marketingMetrics")
			.withIndex("by_tenant_location", (q) => 
				q.eq("tenantId", undefined).eq("location", args.location)
			)
			.filter((q) => 
				q.and(
					q.gte(q.field("month"), args.startMonth),
					q.lte(q.field("month"), args.endMonth)
				)
			)
			.collect();

		return metrics;
	},
});

// Query: Get metrics for a specific channel
export const getChannelMetrics = query({
	args: {
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		channel: v.string(),
		startMonth: v.optional(v.string()),
		endMonth: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		let results = await ctx.db
			.query("marketingMetrics")
			.withIndex("by_tenant_location_channel", (q) => 
				q.eq("tenantId", undefined)
				 .eq("location", args.location)
				 .eq("channel", args.channel)
			)
			.collect();

		if (args.startMonth && args.endMonth) {
			results = results.filter(
				(m) => m.month >= args.startMonth! && m.month <= args.endMonth!
			);
		}

		return results;
	},
});

// Query: Get channel performance summary
export const getChannelPerformanceSummary = query({
	args: {
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		month: v.string(),
	},
	handler: async (ctx, args) => {
		const metrics = await ctx.db
			.query("marketingMetrics")
			.withIndex("by_tenant_location_month", (q) => 
				q.eq("tenantId", undefined)
				 .eq("location", args.location)
				 .eq("month", args.month)
			)
			.collect();

		// Sort by ROI descending
		return metrics.sort((a, b) => b.roi - a.roi);
	},
});

// Query: Get all channels with metrics across all months
export const getAllChannels = query({
	args: {
		location: v.optional(v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago"))),
	},
	handler: async (ctx, args) => {
		const query = args.location
			? ctx.db.query("marketingMetrics")
				.withIndex("by_tenant_location", (q) =>
					q.eq("tenantId", undefined).eq("location", args.location!)
				)
			: ctx.db.query("marketingMetrics")
				.withIndex("by_tenant", (q) => q.eq("tenantId", undefined));

		const metrics = await query.collect();

		// Get unique channels
		const channels = [...new Set(metrics.map(m => m.channel))];
		return channels;
	},
});

// Mutation: Upsert marketing metrics
export const upsertMetrics = mutation({
	args: {
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		month: v.string(),
		channel: v.string(),
		spend: v.number(),
		leads: v.number(),
		conversions: v.number(),
		revenue: v.number(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Calculate derived metrics
		const cpl = args.leads > 0 ? args.spend / args.leads : 0;
		const conversionRate = args.leads > 0 ? (args.conversions / args.leads) * 100 : 0;
		const roi = args.spend > 0 ? ((args.revenue - args.spend) / args.spend) * 100 : 0;

		// Check if record already exists
		const existing = await ctx.db
			.query("marketingMetrics")
			.withIndex("by_tenant_location_month", (q) => 
				q.eq("tenantId", undefined)
				 .eq("location", args.location)
				 .eq("month", args.month)
			)
			.filter((q) => q.eq(q.field("channel"), args.channel))
			.first();

		if (existing) {
			// Update existing
			await ctx.db.patch(existing._id, {
				spend: args.spend,
				leads: args.leads,
				conversions: args.conversions,
				revenue: args.revenue,
				cpl,
				conversionRate,
				roi,
				notes: args.notes,
				updatedAt: Date.now(),
			});
			return existing._id;
		} else {
			// Insert new
			const id = await ctx.db.insert("marketingMetrics", {
				location: args.location,
				month: args.month,
				channel: args.channel,
				spend: args.spend,
				leads: args.leads,
				conversions: args.conversions,
				revenue: args.revenue,
				cpl,
				conversionRate,
				roi,
				notes: args.notes,
				updatedAt: Date.now(),
			});
			return id;
		}
	},
});

// Mutation: Delete metrics (for corrections)
export const deleteMetrics = mutation({
	args: {
		id: v.id("marketingMetrics"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
	},
});

// Lead Attribution Queries and Mutations

// Query: Get leads by channel
export const getLeadsByChannel = query({
	args: {
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		channel: v.string(),
		startDate: v.optional(v.string()),
		endDate: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		let results = await ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_channel", (q) => 
				q.eq("tenantId", undefined).eq("channel", args.channel)
			)
			.filter((q) => q.eq(q.field("location"), args.location))
			.collect();

		if (args.startDate && args.endDate) {
			results = results.filter(
				(l) => l.leadDate >= args.startDate! && l.leadDate <= args.endDate!
			);
		}

		return results;
	},
});

// Query: Get leads by status
export const getLeadsByStatus = query({
	args: {
		location: v.optional(v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago"))),
		status: v.union(
			v.literal("new"),
			v.literal("contacted"),
			v.literal("quoted"),
			v.literal("booked"),
			v.literal("completed"),
			v.literal("lost"),
		),
	},
	handler: async (ctx, args) => {
		let query = ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_status", (q) => 
				q.eq("tenantId", undefined).eq("status", args.status)
			);

		const results = await query.collect();

		if (args.location) {
			return results.filter((l) => l.location === args.location);
		}

		return results;
	},
});

// Query: Get lead by ID
export const getLeadById = query({
	args: {
		leadId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_leadId", (q) => 
				q.eq("tenantId", undefined).eq("leadId", args.leadId)
			)
			.first();
	},
});

// Mutation: Create lead attribution
export const createLead = mutation({
	args: {
		leadId: v.string(),
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		channel: v.string(),
		leadDate: v.string(),
		customerName: v.string(),
		status: v.optional(v.union(
			v.literal("new"),
			v.literal("contacted"),
			v.literal("quoted"),
			v.literal("booked"),
			v.literal("completed"),
			v.literal("lost"),
		)),
		revenue: v.optional(v.number()),
		smOrderId: v.optional(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if lead already exists
		const existing = await ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_leadId", (q) => 
				q.eq("tenantId", undefined).eq("leadId", args.leadId)
			)
			.first();

		if (existing) {
			throw new Error(`Lead ${args.leadId} already exists`);
		}

		const id = await ctx.db.insert("leadAttribution", {
			leadId: args.leadId,
			location: args.location,
			channel: args.channel,
			leadDate: args.leadDate,
			customerName: args.customerName,
			status: args.status || "new",
			revenue: args.revenue || 0,
			smOrderId: args.smOrderId,
			notes: args.notes,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		return id;
	},
});

// Mutation: Update lead status and revenue
export const updateLead = mutation({
	args: {
		leadId: v.string(),
		status: v.optional(v.union(
			v.literal("new"),
			v.literal("contacted"),
			v.literal("quoted"),
			v.literal("booked"),
			v.literal("completed"),
			v.literal("lost"),
		)),
		revenue: v.optional(v.number()),
		notes: v.optional(v.string()),
		smOrderId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const lead = await ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_leadId", (q) => 
				q.eq("tenantId", undefined).eq("leadId", args.leadId)
			)
			.first();

		if (!lead) {
			throw new Error(`Lead ${args.leadId} not found`);
		}

		const updates: any = {
			updatedAt: Date.now(),
		};

		if (args.status !== undefined) updates.status = args.status;
		if (args.revenue !== undefined) updates.revenue = args.revenue;
		if (args.notes !== undefined) updates.notes = args.notes;
		if (args.smOrderId !== undefined) updates.smOrderId = args.smOrderId;

		await ctx.db.patch(lead._id, updates);

		return lead._id;
	},
});

// Mutation: Delete lead
export const deleteLead = mutation({
	args: {
		leadId: v.string(),
	},
	handler: async (ctx, args) => {
		const lead = await ctx.db
			.query("leadAttribution")
			.withIndex("by_tenant_leadId", (q) => 
				q.eq("tenantId", undefined).eq("leadId", args.leadId)
			)
			.first();

		if (!lead) {
			throw new Error(`Lead ${args.leadId} not found`);
		}

		await ctx.db.delete(lead._id);
	},
});
