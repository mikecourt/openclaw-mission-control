import { query } from "./_generated/server";
import { v } from "convex/values";

// --- Claude Max Plan Budget Config ---
const PLAN_CONFIG = {
	monthlyBudget: 200,
	weeklyBudget: 50,
	sessionWindowBudget: 7,
	sessionWindowMs: 5 * 60 * 60 * 1000, // 5 hours
	MST_OFFSET_MS: 7 * 60 * 60 * 1000, // UTC-7
};

function assertTenant(
	record: { tenantId?: string } | null,
	tenantId: string,
	entityName: string,
) {
	if (!record || record.tenantId !== tenantId) {
		throw new Error(`${entityName} not found`);
	}
}

export const listAgents = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();
	},
});

export const listTasks = query({
	args: {
		tenantId: v.string(),
		projectId: v.optional(v.id("projects")),
		unassigned: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		let tasksQuery;
		if (args.projectId) {
			tasksQuery = ctx.db
				.query("tasks")
				.withIndex("by_tenant_project", (q) =>
					q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
				);
		} else {
			tasksQuery = ctx.db
				.query("tasks")
				.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
		}

		let tasks = await tasksQuery.collect();

		// Filter to only tasks without a projectId
		if (args.unassigned) {
			tasks = tasks.filter((t) => !t.projectId);
		}

		// Enrich tasks with last message time
		const enrichedTasks = await Promise.all(
			tasks.map(async (task) => {
				const lastMessage = await ctx.db
					.query("messages")
					.withIndex("by_tenant_task", (q) =>
						q.eq("tenantId", args.tenantId).eq("taskId", task._id),
					)
					.order("desc")
					.first();

				return {
					...task,
					lastMessageTime: lastMessage?._creationTime ?? null,
				};
			})
		);

		return enrichedTasks;
	},
});

export const listActivities = query({
	args: {
		tenantId: v.string(),
		agentId: v.optional(v.id("agents")),
		type: v.optional(v.string()),
		taskId: v.optional(v.id("tasks")),
	},
	handler: async (ctx, args) => {
		let activitiesQuery = ctx.db
			.query("activities")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc");

		if (args.agentId || args.type || args.taskId) {
			activitiesQuery = activitiesQuery.filter((q) => {
				const filters = [];
				if (args.agentId) filters.push(q.eq(q.field("agentId"), args.agentId));
				if (args.taskId) filters.push(q.eq(q.field("targetId"), args.taskId));

				if (args.type) {
					if (args.type === "tasks") {
						filters.push(
							q.or(
								q.eq(q.field("type"), "status_update"),
								q.eq(q.field("type"), "assignees_update"),
								q.eq(q.field("type"), "task_update")
							)
						);
					} else if (args.type === "comments") {
						filters.push(
							q.or(
								q.eq(q.field("type"), "message"),
								q.eq(q.field("type"), "commented")
							)
						);
					} else if (args.type === "decisions") {
						filters.push(
							q.or(
								q.eq(q.field("type"), "decision"),
								q.eq(q.field("type"), "needs_input_resolved"),
								q.eq(q.field("type"), "project_status_change")
							)
						);
					} else if (args.type === "docs") {
						filters.push(q.eq(q.field("type"), "document_created"));
					} else if (args.type === "status") {
						filters.push(q.eq(q.field("type"), "status_update"));
					} else {
						filters.push(q.eq(q.field("type"), args.type));
					}
				}

				return q.and(...filters);
			});
		}

		const activities = await activitiesQuery.take(50);

		const enrichedFeed = await Promise.all(
			activities.map(async (activity) => {
				const agent = await ctx.db.get(activity.agentId);
				return {
					...activity,
					agentName: agent?.name ?? "Unknown Agent",
				};
			}),
		);

		return enrichedFeed;
	},
});

export const listMessages = query({
	args: { taskId: v.id("tasks"), tenantId: v.string() },
	handler: async (ctx, args) => {
		const task = await ctx.db.get(args.taskId);
		assertTenant(task, args.tenantId, "Task");

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_tenant_task", (q) =>
				q.eq("tenantId", args.tenantId).eq("taskId", args.taskId),
			)
			.collect();

		const enrichedMessages = await Promise.all(
			messages.map(async (msg) => {
				const agent = await ctx.db.get(msg.fromAgentId);
				assertTenant(agent, args.tenantId, "Agent");
				return {
					...msg,
					agentName: agent?.name ?? "Unknown",
					agentAvatar: agent?.avatar,
				};
			})
		);

		return enrichedMessages;
	},
});

// --- Agent-facing queries ---

export const getInboxTasks = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("tasks")
			.withIndex("by_tenant_status", (q) =>
				q.eq("tenantId", args.tenantId).eq("status", "inbox")
			)
			.collect();
	},
});

export const getAgentTasks = query({
	args: {
		tenantId: v.string(),
		agentName: v.string(),
	},
	handler: async (ctx, args) => {
		const agent = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.filter((q) => q.eq(q.field("name"), args.agentName))
			.first();

		if (!agent) return [];

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		return tasks.filter((t) => t.assigneeIds.includes(agent._id));
	},
});

export const getBlockedTasks = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		return tasks.filter((t) =>
			t.blockedBy || t.status === "review" || t.needsInput
		);
	},
});

export const getOverdueTasks = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const now = Date.now();
		const idleThreshold = 24 * 60 * 60 * 1000; // 24 hours

		return tasks.filter((t) => {
			if (t.status === "done" || t.status === "archived") return false;
			// Check due date
			if (t.dueDate && t.dueDate < now) return true;
			// Check idle time (no activity for 24h on active tasks)
			if (t.status === "in_progress" || t.status === "assigned") {
				const lastActive = t.startedAt || t._creationTime;
				if (now - lastActive > idleThreshold) return true;
			}
			return false;
		});
	},
});

export const getNeedsInput = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const filtered = tasks.filter((t) =>
			t.needsInput === true || t.status === "review"
		);

		const enriched = await Promise.all(
			filtered.map(async (task) => {
				let projectName: string | null = null;
				if (task.projectId) {
					const project = await ctx.db.get(task.projectId);
					projectName = project?.name ?? null;
				}

				const lastMessage = await ctx.db
					.query("messages")
					.withIndex("by_tenant_task", (q) =>
						q.eq("tenantId", args.tenantId).eq("taskId", task._id),
					)
					.order("desc")
					.first();

				let lastMessagePreview: { content: string; agentName: string; timestamp: number } | null = null;
				if (lastMessage) {
					const agent = await ctx.db.get(lastMessage.fromAgentId);
					lastMessagePreview = {
						content: lastMessage.content,
						agentName: agent?.name ?? "Unknown",
						timestamp: lastMessage._creationTime,
					};
				}

				return {
					...task,
					projectName,
					lastMessagePreview,
				};
			})
		);

		return enriched;
	},
});

// --- Agent lookup ---

export const getAgentByName = query({
	args: {
		tenantId: v.string(),
		agentName: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.filter((q) => q.eq(q.field("name"), args.agentName))
			.first();
	},
});

// --- Next work selection ---

const PRIORITY_ORDER: Record<string, number> = {
	urgent: 0,
	high: 1,
	medium: 2,
	low: 3,
};

export const getNextWork = query({
	args: {
		tenantId: v.string(),
		agentName: v.string(),
	},
	handler: async (ctx, args) => {
		const agent = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.filter((q) => q.eq(q.field("name"), args.agentName))
			.first();

		if (!agent) {
			return { task: null, reason: `Agent "${args.agentName}" not found` };
		}

		// 1. Tasks assigned to this agent, in_progress and not blocked on input
		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const myInProgress = allTasks.filter(
			(t) =>
				t.assigneeIds.includes(agent._id) &&
				t.status === "in_progress" &&
				!t.needsInput
		);
		if (myInProgress.length > 0) {
			return {
				task: myInProgress[0],
				reason: "Assigned to you, status: in_progress",
			};
		}

		// 2. Tasks assigned to this agent with status "assigned"
		const myAssigned = allTasks.filter(
			(t) =>
				t.assigneeIds.includes(agent._id) && t.status === "assigned"
		);
		if (myAssigned.length > 0) {
			return {
				task: myAssigned[0],
				reason: "Assigned to you, status: assigned",
			};
		}

		// 3. Unassigned inbox tasks sorted by priority then creation time
		const inboxTasks = allTasks
			.filter(
				(t) =>
					t.status === "inbox" && t.assigneeIds.length === 0
			)
			.sort((a, b) => {
				const aPri = PRIORITY_ORDER[a.priority ?? ""] ?? 4;
				const bPri = PRIORITY_ORDER[b.priority ?? ""] ?? 4;
				if (aPri !== bPri) return aPri - bPri;
				return a._creationTime - b._creationTime;
			});

		if (inboxTasks.length > 0) {
			const t = inboxTasks[0];
			const priLabel = t.priority ?? "none";
			return {
				task: t,
				reason: `Unassigned inbox task (priority: ${priLabel})`,
			};
		}

		return { task: null, reason: "No tasks available" };
	},
});

// --- Dispatch summary (for Aiden's dispatch loop) ---

const BUSINESS_AGENTS = ["Maven", "Chase", "Morgan", "Harper", "Forge", "Charlie"];

export const getDispatchSummary = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const allAgents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const businessAgents = allAgents.filter((a) =>
			BUSINESS_AGENTS.includes(a.name)
		);

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const now = Date.now();
		const stallThreshold = 4 * 60 * 60 * 1000; // 4 hours

		// Idle agents
		const idleAgents = businessAgents
			.filter((a) => a.status === "idle" || a.status === "off")
			.map((a) => ({ id: a._id, name: a.name, status: a.status, role: a.role }));

		// Active agents with current task info
		const activeAgents = await Promise.all(
			businessAgents
				.filter((a) => a.status === "active")
				.map(async (a) => {
					let currentTask = null;
					if (a.currentTaskId) {
						const task = await ctx.db.get(a.currentTaskId);
						if (task) {
							currentTask = {
								id: task._id,
								title: task.title,
								status: task.status,
								startedAt: task.startedAt,
							};
						}
					}
					// Fallback: find their in-progress task
					if (!currentTask) {
						const inProgress = allTasks.find(
							(t) =>
								t.assigneeIds.includes(a._id) &&
								t.status === "in_progress"
						);
						if (inProgress) {
							currentTask = {
								id: inProgress._id,
								title: inProgress.title,
								status: inProgress.status,
								startedAt: inProgress.startedAt,
							};
						}
					}
					return {
						id: a._id,
						name: a.name,
						role: a.role,
						currentTask,
					};
				})
		);

		// Unassigned inbox tasks sorted by priority
		const inboxTasks = allTasks
			.filter((t) => t.status === "inbox" && t.assigneeIds.length === 0)
			.sort((a, b) => {
				const aPri = PRIORITY_ORDER[a.priority ?? ""] ?? 4;
				const bPri = PRIORITY_ORDER[b.priority ?? ""] ?? 4;
				if (aPri !== bPri) return aPri - bPri;
				return a._creationTime - b._creationTime;
			})
			.map((t) => ({
				id: t._id,
				title: t.title,
				priority: t.priority ?? "none",
				tags: t.tags,
				createdAt: t._creationTime,
				source: t.source,
			}));

		// Stalled tasks: in_progress for >4 hours
		const stalledTasks = allTasks
			.filter((t) => {
				if (t.status !== "in_progress") return false;
				const startTime = t.startedAt || t._creationTime;
				return now - startTime > stallThreshold;
			})
			.map((t) => {
				const assigneeNames = businessAgents
					.filter((a) => t.assigneeIds.includes(a._id))
					.map((a) => a.name);
				return {
					id: t._id,
					title: t.title,
					assignees: assigneeNames,
					startedAt: t.startedAt || t._creationTime,
					hoursStalled: Math.round((now - (t.startedAt || t._creationTime)) / (60 * 60 * 1000)),
				};
			});

		return {
			timestamp: now,
			idleAgents,
			activeAgents,
			inboxTasks,
			stalledTasks,
			summary: {
				idle: idleAgents.length,
				active: activeAgents.length,
				queueDepth: inboxTasks.length,
				stalled: stalledTasks.length,
			},
		};
	},
});

// --- Cost/Usage queries ---

export const getUsageSummary = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const usage = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		let totalCost = 0;
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		let todayCost = 0;
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		const modelCosts: Record<string, { cost: number; calls: number; tokens: number }> = {};

		for (const record of usage) {
			totalCost += record.cost;
			totalInputTokens += record.inputTokens;
			totalOutputTokens += record.outputTokens;

			if (record._creationTime >= todayMs) {
				todayCost += record.cost;
			}

			if (!modelCosts[record.model]) {
				modelCosts[record.model] = { cost: 0, calls: 0, tokens: 0 };
			}
			modelCosts[record.model].cost += record.cost;
			modelCosts[record.model].calls += 1;
			modelCosts[record.model].tokens += record.inputTokens + record.outputTokens;
		}

		// MTD cost
		const monthStart = new Date();
		monthStart.setDate(1);
		monthStart.setHours(0, 0, 0, 0);
		const monthMs = monthStart.getTime();
		let mtdCost = 0;
		for (const record of usage) {
			if (record._creationTime >= monthMs) {
				mtdCost += record.cost;
			}
		}

		return {
			totalCost,
			todayCost,
			mtdCost,
			totalInputTokens,
			totalOutputTokens,
			modelCosts,
			recordCount: usage.length,
		};
	},
});

export const getAgentUtilization = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const usage = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		return agents.map((agent) => {
			const agentTasks = tasks.filter((t) => t.assigneeIds.includes(agent._id));
			const completedTasks = agentTasks.filter((t) => t.status === "done" || t.status === "archived");
			const activeTasks = agentTasks.filter((t) => t.status === "in_progress" || t.status === "assigned");
			const reviewTasks = agentTasks.filter((t) => t.status === "review");

			const agentUsage = usage.filter((u) => u.agentId === agent.name);
			const agentCost = agentUsage.reduce((sum, u) => sum + u.cost, 0);
			const agentTokens = agentUsage.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0);

			return {
				agentId: agent._id,
				name: agent.name,
				avatar: agent.avatar,
				status: agent.status,
				role: agent.role,
				completedCount: completedTasks.length,
				activeCount: activeTasks.length,
				reviewCount: reviewTasks.length,
				totalCost: agentCost,
				totalTokens: agentTokens,
			};
		});
	},
});

// --- Plan Budget Health ---

export const getPlanUsage = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		// Prefer real plan usage from Anthropic API if available and fresh (< 5 min)
		const snapshot = await ctx.db
			.query("planUsageSnapshot")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		const now = Date.now();
		const SNAPSHOT_STALE_MS = 5 * 60 * 1000; // 5 minutes

		if (snapshot && (now - snapshot.fetchedAt) < SNAPSHOT_STALE_MS) {
			const sessionResetMs = snapshot.sessionResetAt
				? Math.max(new Date(snapshot.sessionResetAt).getTime() - now, 0)
				: 0;
			const weeklyResetMs = snapshot.weeklyResetAt
				? Math.max(new Date(snapshot.weeklyResetAt).getTime() - now, 0)
				: 0;

			return {
				session: {
					cost: 0,
					budget: PLAN_CONFIG.sessionWindowBudget,
					pct: snapshot.sessionPct,
					resetMs: sessionResetMs,
				},
				weekly: {
					cost: 0,
					budget: PLAN_CONFIG.weeklyBudget,
					pct: snapshot.weeklyPct,
					resetMs: weeklyResetMs,
				},
				monthly: { cost: 0, budget: PLAN_CONFIG.monthlyBudget, pct: 0 },
				burnRate: { dailyAverage: 0, projectedWeekly: 0 },
				headroom: {
					canDispatchOpus: snapshot.sessionPct < 80 && snapshot.weeklyPct < 80,
					suggestLocal: snapshot.sessionPct > 60 || snapshot.weeklyPct > 70,
				},
				source: "anthropic" as const,
			};
		}

		// Fallback: compute from local usage records
		const usage = await ctx.db
			.query("usage")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		// MST-adjusted time for week/month boundaries
		const mstNow = new Date(now - PLAN_CONFIG.MST_OFFSET_MS);

		// Session window: last 5 hours
		const sessionStart = now - PLAN_CONFIG.sessionWindowMs;

		// Weekly: Monday 00:00 MST
		const mstDay = mstNow.getUTCDay(); // 0=Sun
		const daysSinceMonday = mstDay === 0 ? 6 : mstDay - 1;
		const weekStartMst = new Date(mstNow);
		weekStartMst.setUTCDate(weekStartMst.getUTCDate() - daysSinceMonday);
		weekStartMst.setUTCHours(0, 0, 0, 0);
		const weekStartMs = weekStartMst.getTime() + PLAN_CONFIG.MST_OFFSET_MS;

		// Next Monday 00:00 MST
		const nextMondayMst = new Date(weekStartMst);
		nextMondayMst.setUTCDate(nextMondayMst.getUTCDate() + 7);
		const nextMondayMs = nextMondayMst.getTime() + PLAN_CONFIG.MST_OFFSET_MS;

		// Monthly: 1st of month 00:00 MST
		const monthStartMst = new Date(mstNow);
		monthStartMst.setUTCDate(1);
		monthStartMst.setUTCHours(0, 0, 0, 0);
		const monthStartMs = monthStartMst.getTime() + PLAN_CONFIG.MST_OFFSET_MS;

		// Single-pass bucketing
		let sessionCost = 0;
		let weeklyCost = 0;
		let monthlyCost = 0;
		let oldestSessionTs = Infinity;
		let weeklyRecordCount = 0;

		for (const record of usage) {
			const ts = record._creationTime;
			if (ts >= monthStartMs) {
				monthlyCost += record.cost;
			}
			if (ts >= weekStartMs) {
				weeklyCost += record.cost;
				weeklyRecordCount++;
			}
			if (ts >= sessionStart) {
				sessionCost += record.cost;
				if (ts < oldestSessionTs) {
					oldestSessionTs = ts;
				}
			}
		}

		// Session reset: time until oldest record in window rolls out
		const sessionResetMs =
			oldestSessionTs === Infinity
				? 0
				: oldestSessionTs + PLAN_CONFIG.sessionWindowMs - now;

		// Weekly reset: time until next Monday 00:00 MST
		const weeklyResetMs = nextMondayMs - now;

		const sessionPct = (sessionCost / PLAN_CONFIG.sessionWindowBudget) * 100;
		const weeklyPct = (weeklyCost / PLAN_CONFIG.weeklyBudget) * 100;
		const monthlyPct = (monthlyCost / PLAN_CONFIG.monthlyBudget) * 100;

		// Burn rate: daily average based on weekly spend
		const daysIntoWeek = Math.max(daysSinceMonday + 1, 1);
		const dailyAverage = weeklyCost / daysIntoWeek;
		const projectedWeekly = dailyAverage * 7;

		return {
			session: {
				cost: Math.round(sessionCost * 100) / 100,
				budget: PLAN_CONFIG.sessionWindowBudget,
				pct: Math.round(sessionPct),
				resetMs: Math.max(sessionResetMs, 0),
			},
			weekly: {
				cost: Math.round(weeklyCost * 100) / 100,
				budget: PLAN_CONFIG.weeklyBudget,
				pct: Math.round(weeklyPct),
				resetMs: Math.max(weeklyResetMs, 0),
			},
			monthly: {
				cost: Math.round(monthlyCost * 100) / 100,
				budget: PLAN_CONFIG.monthlyBudget,
				pct: Math.round(monthlyPct),
			},
			burnRate: {
				dailyAverage: Math.round(dailyAverage * 100) / 100,
				projectedWeekly: Math.round(projectedWeekly * 100) / 100,
			},
			headroom: {
				canDispatchOpus: sessionPct < 80 && weeklyPct < 80,
				suggestLocal: sessionPct > 60 || weeklyPct > 70,
			},
		};
	},
});
