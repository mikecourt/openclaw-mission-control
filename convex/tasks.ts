import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function requireTenant<T extends { tenantId?: string }>(
	record: T | null,
	tenantId: string,
	entityName: string,
) : T {
	if (!record || record.tenantId !== tenantId) {
		throw new Error(`${entityName} not found`);
	}
	return record;
}

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("archived")
    ),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    requireTenant(await ctx.db.get(args.agentId), args.tenantId, "Agent");

    const patch: Record<string, unknown> = { status: args.status };
    const wasNeedsInput = task.needsInput;
    // Clear needsInput when moving out of review
    if (args.status !== "review" && task.needsInput) {
      patch.needsInput = false;
    }

    await ctx.db.patch(args.taskId, patch);

    await ctx.db.insert("activities", {
      type: "status_update",
      agentId: args.agentId,
      message: `changed status of "${task.title}" to ${args.status}`,
      targetId: args.taskId,
      tenantId: args.tenantId,
    });

    // Log as a decision when resolving a needsInput task
    if (wasNeedsInput && args.status !== "review") {
      await ctx.db.insert("activities", {
        type: "needs_input_resolved",
        agentId: args.agentId,
        message: `resolved input needed on "${task.title}" → ${args.status}`,
        targetId: args.taskId,
        tenantId: args.tenantId,
      });
    }
  },
});

export const updateAssignees = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
    assigneeIds: v.array(v.id("agents")),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    requireTenant(await ctx.db.get(args.agentId), args.tenantId, "Agent");

    for (const assigneeId of args.assigneeIds) {
      requireTenant(await ctx.db.get(assigneeId), args.tenantId, "Assignee");
    }

    await ctx.db.patch(args.taskId, { assigneeIds: args.assigneeIds });

    await ctx.db.insert("activities", {
      type: "assignees_update",
      agentId: args.agentId,
      message: `updated assignees for "${task.title}"`,
      targetId: args.taskId,
      tenantId: args.tenantId,
    });
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    status: v.string(),
    tags: v.array(v.string()),
    borderColor: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    source: v.optional(v.string()),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status as any,
      assigneeIds: [],
      tags: args.tags,
      borderColor: args.borderColor,
      projectId: args.projectId,
      priority: args.priority as any,
      dueDate: args.dueDate,
      source: (args.source as any) || "manual",
      tenantId: args.tenantId,
    });
    return taskId;
  },
});

export const archiveTask = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    requireTenant(await ctx.db.get(args.agentId), args.tenantId, "Agent");

    await ctx.db.patch(args.taskId, { status: "archived" });

    await ctx.db.insert("activities", {
      type: "status_update",
      agentId: args.agentId,
      message: `archived "${task.title}"`,
      targetId: args.taskId,
      tenantId: args.tenantId,
    });
  },
});

export const linkRun = mutation({
  args: {
    taskId: v.id("tasks"),
    openclawRunId: v.string(),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    requireTenant(await ctx.db.get(args.taskId), args.tenantId, "Task");

    await ctx.db.patch(args.taskId, {
      openclawRunId: args.openclawRunId,
      startedAt: Date.now(),
    });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    blockedBy: v.optional(v.string()),
    needsInput: v.optional(v.boolean()),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    requireTenant(await ctx.db.get(args.agentId), args.tenantId, "Agent");

    const fields: Record<string, unknown> = {};
    const updates: string[] = [];

    if (args.title !== undefined) {
      fields.title = args.title;
      updates.push("title");
    }
    if (args.description !== undefined) {
      fields.description = args.description;
      updates.push("description");
    }
    if (args.tags !== undefined) {
      fields.tags = args.tags;
      updates.push("tags");
    }
    if (args.projectId !== undefined) {
      fields.projectId = args.projectId;
      updates.push("project");
    }
    if (args.priority !== undefined) {
      fields.priority = args.priority;
      updates.push("priority");
    }
    if (args.dueDate !== undefined) {
      fields.dueDate = args.dueDate;
      updates.push("due date");
    }
    if (args.blockedBy !== undefined) {
      fields.blockedBy = args.blockedBy;
      updates.push("blocker");
    }
    if (args.needsInput !== undefined) {
      fields.needsInput = args.needsInput;
      updates.push("needs input");
    }

    await ctx.db.patch(args.taskId, fields);

    if (updates.length > 0) {
      await ctx.db.insert("activities", {
        type: "task_update",
        agentId: args.agentId,
        message: `updated ${updates.join(", ")} of "${task.title}"`,
        targetId: args.taskId,
        tenantId: args.tenantId,
      });
    }
  },
});

export const listTasksFiltered = query({
  args: {
    tenantId: v.string(),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    businessUnit: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    if (args.status) {
      tasks = tasks.filter((t) => t.status === args.status);
    }
    if (args.priority) {
      tasks = tasks.filter((t) => t.priority === args.priority);
    }
    if (args.businessUnit) {
      tasks = tasks.filter((t) => t.businessUnit === args.businessUnit);
    }
    if (args.agentId) {
      tasks = tasks.filter((t) => t.assigneeIds.includes(args.agentId!));
    }
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      tasks = tasks.filter((t) => t.title.toLowerCase().includes(searchLower));
    }

    tasks.sort((a, b) => b._creationTime - a._creationTime);

    return tasks.slice(0, limit);
  },
});

export const getTaskStats = query({
  args: {
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const byPriority: Record<string, number> = {};
    const byBusinessUnit: Record<string, number> = {};

    let active = 0;
    let queued = 0;
    let completedToday = 0;
    let failedToday = 0;
    let review = 0;

    for (const task of tasks) {
      if (task.status === "in_progress") active++;
      if (task.status === "inbox" || task.status === "assigned") queued++;
      if (task.status === "done" && task._creationTime >= startOfToday) completedToday++;
      if (task.status === "archived" && task._creationTime >= startOfToday) failedToday++;
      if (task.status === "review") review++;

      if (task.priority) {
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      }
      if (task.businessUnit) {
        byBusinessUnit[task.businessUnit] = (byBusinessUnit[task.businessUnit] || 0) + 1;
      }
    }

    return {
      active,
      queued,
      completedToday,
      failedToday,
      review,
      byPriority,
      byBusinessUnit,
      total: tasks.length,
    };
  },
});

export const reassignTask = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
    newAssigneeIds: v.array(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    await ctx.db.patch(args.taskId, { assigneeIds: args.newAssigneeIds });

    await ctx.db.insert("activities", {
      type: "reassignment",
      agentId: args.newAssigneeIds[0],
      message: `reassigned "${task.title}"`,
      targetId: args.taskId,
      tenantId: args.tenantId,
    });
  },
});

export const escalateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    const escalationHistory = task.escalationHistory || [];

    // Find the last agent that handled this task
    let lastAgentName: string | undefined;
    if (escalationHistory.length > 0) {
      lastAgentName = escalationHistory[escalationHistory.length - 1].agentId;
    } else if (task.assigneeIds.length > 0) {
      const lastAssignee = await ctx.db.get(task.assigneeIds[task.assigneeIds.length - 1]);
      if (lastAssignee) {
        lastAgentName = lastAssignee.name;
      }
    }

    if (!lastAgentName) {
      throw new Error("No escalation path available");
    }

    // Look up the agent to find their escalation path
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_tenant_name", (q) =>
        q.eq("tenantId", args.tenantId).eq("name", lastAgentName!)
      )
      .first();

    if (!agent || !agent.escalationPath || agent.escalationPath.length === 0) {
      throw new Error("No escalation path available");
    }

    // Find the next agent in the escalation path
    const currentIndex = agent.escalationPath.indexOf(lastAgentName);
    const nextAgentName = currentIndex >= 0 && currentIndex < agent.escalationPath.length - 1
      ? agent.escalationPath[currentIndex + 1]
      : agent.escalationPath[0];

    const updatedHistory = [
      ...escalationHistory,
      {
        agentId: nextAgentName,
        timestamp: Date.now(),
        status: "escalated",
      },
    ];

    await ctx.db.patch(args.taskId, { escalationHistory: updatedHistory });

    // Find any agent to attribute the activity to
    const activityAgent = task.assigneeIds.length > 0 ? task.assigneeIds[0] : undefined;
    if (activityAgent) {
      await ctx.db.insert("activities", {
        type: "escalation",
        agentId: activityAgent,
        message: `escalated "${task.title}" to ${nextAgentName}`,
        targetId: args.taskId,
        tenantId: args.tenantId,
      });
    }
  },
});

export const retryTask = mutation({
  args: {
    taskId: v.id("tasks"),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const task = requireTenant(
      await ctx.db.get(args.taskId),
      args.tenantId,
      "Task"
    );

    const newTaskId = await ctx.db.insert("tasks", {
      title: `${task.title} (retry)`,
      description: task.description,
      status: "inbox",
      tags: task.tags,
      priority: task.priority,
      businessUnit: task.businessUnit,
      source: task.source,
      assigneeIds: [],
      tenantId: args.tenantId,
    });

    return newTaskId;
  },
});
