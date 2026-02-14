import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function assertTenant(
	record: { tenantId?: string } | null,
	tenantId: string,
	entityName: string,
) {
	if (!record || record.tenantId !== tenantId) {
		throw new Error(`${entityName} not found`);
	}
}

export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    tenantId: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("blocked"),
      v.literal("off"),
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");

    await ctx.db.patch(args.id, {
      status: args.status,
      isEnabled: args.status !== "off",
    });
  },
});

export const updateAgent = mutation({
  args: {
    id: v.id("agents"),
    tenantId: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    level: v.optional(v.union(v.literal("LEAD"), v.literal("INT"), v.literal("SPC"))),
    avatar: v.optional(v.string()),
    status: v.optional(v.union(v.literal("idle"), v.literal("active"), v.literal("blocked"), v.literal("off"))),
    reportsTo: v.optional(v.id("agents")),
    canInteractWith: v.optional(v.union(
      v.literal("any"),
      v.array(v.id("agents")),
    )),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");

    const { id, tenantId: _tenantId, ...updates } = args;
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
  },
});

export const updateStatusByName = mutation({
  args: {
    tenantId: v.string(),
    agentName: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("blocked"),
      v.literal("off"),
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.agentName),
          q.eq(q.field("tenantId"), args.tenantId),
        ),
      )
      .first();

    if (!agent) {
      throw new Error(`Agent "${args.agentName}" not found`);
    }

    await ctx.db.patch(agent._id, { status: args.status });
  },
});

export const toggleAgent = mutation({
  args: {
    id: v.id("agents"),
    tenantId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");
    await ctx.db.patch(args.id, {
      isEnabled: args.enabled,
      status: args.enabled ? "idle" : "off",
    });
  },
});

export const getAgentWithMetrics = query({
  args: {
    id: v.id("agents"),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");

    // Get all tasks for this tenant
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Filter to this agent's tasks
    const agentTasks = tasks.filter((t) => t.assigneeIds.includes(args.id));
    const active = agentTasks.filter(
      (t) => t.status === "in_progress" || t.status === "assigned"
    ).length;
    const completed = agentTasks.filter(
      (t) => t.status === "done" || t.status === "archived"
    ).length;
    const review = agentTasks.filter((t) => t.status === "review").length;

    // Get recent agentMetrics (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

    const recentMetrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_tenant_agent", (q) =>
        q.eq("tenantId", args.tenantId).eq("agentId", agent!.name)
      )
      .filter((q) => q.gte(q.field("date"), cutoffDate))
      .collect();

    return {
      agent: agent!,
      taskCounts: { active, completed, review },
      recentMetrics,
    };
  },
});

// Bulk sync agents from external source (e.g., openclaw.json + agents-registry.json)
export const syncAgents = mutation({
  args: {
    tenantId: v.string(),
    agents: v.array(v.object({
      name: v.string(),
      role: v.string(),
      avatar: v.optional(v.string()),
      orgId: v.optional(v.string()),
      workspaceId: v.optional(v.string()),
      kind: v.optional(v.string()),
      reportsTo: v.optional(v.string()),  // Agent name, not ID
      model: v.optional(v.string()),
      businessUnit: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;

    // First pass: create/update agents (reportsTo will be null initially)
    for (const agentData of args.agents) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_tenant_name", (q) =>
          q.eq("tenantId", args.tenantId).eq("name", agentData.name)
        )
        .first();

      if (existing) {
        // Update existing agent
        await ctx.db.patch(existing._id, {
          role: agentData.role,
          avatar: agentData.avatar || existing.avatar,
          orgId: agentData.orgId,
          workspaceId: agentData.workspaceId,
          model: agentData.model,
          businessUnit: agentData.businessUnit,
        });
        updated++;
      } else {
        // Create new agent
        await ctx.db.insert("agents", {
          name: agentData.name,
          role: agentData.role,
          avatar: agentData.avatar || `/avatars/${agentData.name.toLowerCase()}.jpg`,
          level: "INT" as const,  // Default level
          status: agentData.kind === "human" ? "off" as const : "idle" as const,
          orgId: agentData.orgId,
          workspaceId: agentData.workspaceId,
          tenantId: args.tenantId,
          model: agentData.model,
          businessUnit: agentData.businessUnit,
        });
        created++;
      }
    }

    // Second pass: resolve reportsTo relationships by name
    let resolved = 0;
    for (const agentData of args.agents) {
      if (!agentData.reportsTo) continue;

      const agent = await ctx.db
        .query("agents")
        .withIndex("by_tenant_name", (q) =>
          q.eq("tenantId", args.tenantId).eq("name", agentData.name)
        )
        .first();

      const reportsToAgent = await ctx.db
        .query("agents")
        .withIndex("by_tenant_name", (q) =>
          q.eq("tenantId", args.tenantId).eq("name", agentData.reportsTo!)
        )
        .first();

      if (agent && reportsToAgent) {
        await ctx.db.patch(agent._id, { reportsTo: reportsToAgent._id });
        resolved++;
      }
    }

    // Third pass: delete agents not in the incoming payload
    // Safety guard: skip deletions if >50% of existing agents would be removed
    const incomingNames = new Set(args.agents.map((a) => a.name));
    const allExisting = await ctx.db
      .query("agents")
      .withIndex("by_tenant_name", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const toDelete = allExisting.filter((a) => !incomingNames.has(a.name));
    let deleted = 0;

    if (allExisting.length > 0 && toDelete.length > allExisting.length * 0.5) {
      // Skip deletions — likely a partial/buggy sync
      console.warn(
        `[syncAgents] Skipping deletion: would remove ${toDelete.length}/${allExisting.length} agents (>50%)`
      );
    } else {
      for (const agent of toDelete) {
        await ctx.db.delete(agent._id);
        deleted++;
      }
    }

    return {
      created,
      updated,
      resolved,
      deleted,
      total: args.agents.length,
    };
  },
});
