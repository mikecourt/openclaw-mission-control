import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function requireTenant<T extends { tenantId?: string }>(
	record: T | null,
	tenantId: string,
	entityName: string,
): T {
	if (!record || record.tenantId !== tenantId) {
		throw new Error(`${entityName} not found`);
	}
	return record;
}

export const create = mutation({
	args: {
		name: v.string(),
		description: v.string(),
		status: v.optional(v.string()),
		area: v.optional(v.string()),
		milestones: v.optional(v.array(v.object({
			name: v.string(),
			targetDate: v.optional(v.number()),
			completedDate: v.optional(v.number()),
		}))),
		borderColor: v.optional(v.string()),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const projectId = await ctx.db.insert("projects", {
			name: args.name,
			description: args.description,
			status: (args.status as any) || "planning",
			area: args.area as any,
			milestones: args.milestones || [],
			borderColor: args.borderColor,
			tenantId: args.tenantId,
		});
		return projectId;
	},
});

export const update = mutation({
	args: {
		projectId: v.id("projects"),
		tenantId: v.string(),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		status: v.optional(v.string()),
		area: v.optional(v.string()),
		milestones: v.optional(v.array(v.object({
			name: v.string(),
			targetDate: v.optional(v.number()),
			completedDate: v.optional(v.number()),
		}))),
		borderColor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const project = requireTenant(
			await ctx.db.get(args.projectId),
			args.tenantId,
			"Project"
		);

		const { projectId, tenantId: _tenantId, ...updates } = args;
		const fields: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				fields[key] = value;
			}
		}

		const oldStatus = project.status;
		await ctx.db.patch(args.projectId, fields);

		// Log project status changes as decisions
		if (args.status && args.status !== oldStatus) {
			// Find any agent to attribute this to (use first active, or any)
			const agents = await ctx.db
				.query("agents")
				.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
				.collect();
			const agent = agents.find((a) => a.name === "Aiden") || agents[0];
			if (agent) {
				await ctx.db.insert("activities", {
					type: "project_status_change",
					agentId: agent._id,
					message: `moved project "${project.name}" from ${oldStatus} to ${args.status}`,
					tenantId: args.tenantId,
				});
			}
		}
	},
});

export const archive = mutation({
	args: {
		projectId: v.id("projects"),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		requireTenant(
			await ctx.db.get(args.projectId),
			args.tenantId,
			"Project"
		);
		await ctx.db.patch(args.projectId, { status: "archived" });
	},
});

export const listAll = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const projects = await ctx.db
			.query("projects")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		// Enrich with task counts per status
		const enriched = await Promise.all(
			projects.map(async (project) => {
				const tasks = await ctx.db
					.query("tasks")
					.withIndex("by_tenant_project", (q) =>
						q.eq("tenantId", args.tenantId).eq("projectId", project._id)
					)
					.collect();

				const taskCounts = {
					total: tasks.length,
					inbox: 0,
					assigned: 0,
					in_progress: 0,
					review: 0,
					done: 0,
					archived: 0,
				};

				let totalCost = 0;
				let needsInputCount = 0;

				for (const task of tasks) {
					const status = task.status as keyof typeof taskCounts;
					if (status in taskCounts) {
						taskCounts[status]++;
					}
					totalCost += task.totalCost || 0;
					if (task.needsInput || task.status === "review") {
						needsInputCount++;
					}
				}

				const activeTotal = taskCounts.total - taskCounts.archived;
				const progress = activeTotal > 0 ? Math.round((taskCounts.done / activeTotal) * 100) : 0;

				return {
					...project,
					taskCounts,
					progress,
					totalCost,
					needsInputCount,
				};
			})
		);

		return enriched;
	},
});

export const getProgress = query({
	args: {
		projectId: v.id("projects"),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const project = requireTenant(
			await ctx.db.get(args.projectId),
			args.tenantId,
			"Project"
		);

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant_project", (q) =>
				q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
			)
			.collect();

		const byStatus: Record<string, number> = {};
		let totalCost = 0;
		let totalTokens = 0;

		for (const task of tasks) {
			byStatus[task.status] = (byStatus[task.status] || 0) + 1;
			totalCost += task.totalCost || 0;
			totalTokens += task.totalTokens || 0;
		}

		const done = byStatus.done || 0;
		const archived = byStatus.archived || 0;
		const total = tasks.length;
		const activeTotal = total - archived;
		const progress = activeTotal > 0 ? Math.round((done / activeTotal) * 100) : 0;

		return {
			project,
			tasks,
			byStatus,
			progress,
			totalCost,
			totalTokens,
			total,
		};
	},
});
