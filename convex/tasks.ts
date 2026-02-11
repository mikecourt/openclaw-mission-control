import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
