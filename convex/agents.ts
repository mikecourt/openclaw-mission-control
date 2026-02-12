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

    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const createAgent = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    level: v.union(v.literal("LEAD"), v.literal("INT"), v.literal("SPC")),
    avatar: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked"), v.literal("off")),
    systemPrompt: v.optional(v.string()),
    character: v.optional(v.string()),
    lore: v.optional(v.string()),
    reportsTo: v.optional(v.id("agents")),
    canInteractWith: v.optional(v.union(
      v.literal("any"),
      v.array(v.id("agents")),
    )),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      name: args.name,
      role: args.role,
      level: args.level,
      avatar: args.avatar,
      status: args.status,
      systemPrompt: args.systemPrompt,
      character: args.character,
      lore: args.lore,
      reportsTo: args.reportsTo,
      canInteractWith: args.canInteractWith,
      tenantId: args.tenantId,
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
    systemPrompt: v.optional(v.string()),
    character: v.optional(v.string()),
    lore: v.optional(v.string()),
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

export const deleteAgent = mutation({
  args: { id: v.id("agents"), tenantId: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");
    await ctx.db.delete(args.id);
  },
});

// --- Phase 3: Agent Directory enhancements ---

export const updateSystemPrompt = mutation({
  args: {
    id: v.id("agents"),
    tenantId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    assertTenant(agent, args.tenantId, "Agent");

    // Push old systemPrompt to promptHistory (create array if missing)
    const history = agent!.promptHistory ?? [];
    if (agent!.systemPrompt) {
      history.push({
        prompt: agent!.systemPrompt,
        savedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.id, {
      systemPrompt: args.prompt,
      promptHistory: history,
    });
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
    await ctx.db.patch(args.id, { isEnabled: args.enabled });
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
