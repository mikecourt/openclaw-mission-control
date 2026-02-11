import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upsert an agent by name (case-insensitive) within a tenant.
 * Only patches metadata fields — never overwrites status or currentTaskId.
 */
export const upsertAgent = mutation({
	args: {
		tenantId: v.string(),
		name: v.string(),
		role: v.string(),
		avatar: v.string(),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		kind: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const nameLower = args.name.toLowerCase();

		// Find existing agent by name (case-insensitive)
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const existing = agents.find(
			(a) => a.name.toLowerCase() === nameLower,
		);

		if (existing) {
			// Patch metadata only — never touch status, currentTaskId
			await ctx.db.patch(existing._id, {
				role: args.role,
				avatar: args.avatar,
				orgId: args.orgId,
				workspaceId: args.workspaceId,
			});
			return { action: "updated" as const, id: existing._id };
		}

		// Insert new agent with defaults
		const isHuman = args.kind === "human";
		const id = await ctx.db.insert("agents", {
			name: args.name,
			role: args.role,
			avatar: args.avatar,
			level: isHuman ? "LEAD" : "SPC",
			status: isHuman ? "off" : "idle",
			orgId: args.orgId,
			workspaceId: args.workspaceId,
			tenantId: args.tenantId,
		});
		return { action: "created" as const, id };
	},
});

/**
 * Resolve reportsTo references after all agents are upserted.
 * Takes an array of {agentName, reportsToName} and patches reportsTo
 * with the resolved Convex document IDs.
 */
export const resolveReportsTo = mutation({
	args: {
		tenantId: v.string(),
		mappings: v.array(
			v.object({
				agentName: v.string(),
				reportsToName: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		// Build lookup maps: lowercase name -> agent, orgId -> agent
		const byName = new Map<string, (typeof agents)[0]>();
		const byOrgId = new Map<string, (typeof agents)[0]>();
		for (const a of agents) {
			byName.set(a.name.toLowerCase(), a);
			if (a.orgId) {
				byOrgId.set(a.orgId.toLowerCase(), a);
			}
		}

		let resolved = 0;
		let skipped = 0;

		for (const { agentName, reportsToName } of args.mappings) {
			const agent =
				byName.get(agentName.toLowerCase()) ||
				byOrgId.get(agentName.toLowerCase());
			const manager =
				byName.get(reportsToName.toLowerCase()) ||
				byOrgId.get(reportsToName.toLowerCase());

			if (!agent || !manager) {
				skipped++;
				continue;
			}

			await ctx.db.patch(agent._id, { reportsTo: manager._id });
			resolved++;
		}

		return { resolved, skipped };
	},
});

/**
 * Return all agents with status="active" and their current task info.
 * Used by the reconciliation script to detect stale statuses.
 */
export const getActiveAgents = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const active = agents.filter((a) => a.status === "active");

		const result = await Promise.all(
			active.map(async (a) => {
				let taskStartedAt: number | undefined;
				let taskTitle: string | undefined;

				if (a.currentTaskId) {
					const task = await ctx.db.get(a.currentTaskId);
					if (task) {
						taskStartedAt = task.startedAt;
						taskTitle = task.title;
					}
				}

				return {
					id: a._id,
					name: a.name,
					orgId: a.orgId,
					taskStartedAt,
					taskTitle,
				};
			}),
		);

		return result;
	},
});

/**
 * Reconcile stale agent statuses. For each agent name in the provided list,
 * set status to "idle" and clear currentTaskId. Optionally mark their
 * in_progress tasks as stale.
 */
export const reconcileStale = mutation({
	args: {
		tenantId: v.string(),
		agentNames: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const byName = new Map(agents.map((a) => [a.name.toLowerCase(), a]));

		let reconciled = 0;

		for (const name of args.agentNames) {
			const agent = byName.get(name.toLowerCase());
			if (!agent || agent.status !== "active") continue;

			// Set agent to idle, clear currentTaskId
			await ctx.db.patch(agent._id, {
				status: "idle",
				currentTaskId: undefined,
			});

			// If the agent had a current task that's still in_progress, mark it
			if (agent.currentTaskId) {
				const task = await ctx.db.get(agent.currentTaskId);
				if (task && task.status === "in_progress") {
					await ctx.db.patch(task._id, {
						status: "review",
						needsInput: true,
					});
				}
			}

			reconciled++;
		}

		return { reconciled };
	},
});
