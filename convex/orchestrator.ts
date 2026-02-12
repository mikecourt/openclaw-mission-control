// ============================================================
// OpenClaw Orchestrator - Routing Logic for Convex Backend
// ============================================================
// Handles task classification, agent routing, escalation management,
// phase scheduling, and Opus budget tracking.
// Adapted to work with the existing MC schema (agents, tasks, phaseState tables).
// ============================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

export const AGENT_IDS = {
	ORCHESTRATOR: "orchestrator",
	EXEC_SEC: "exec-sec",
	RESEARCH: "research",
	FINANCE: "finance",
	ARCHITECT: "architect",
	BACKEND_DEV: "backend-dev",
	FRONTEND_DEV: "frontend-dev",
	AUTO_ENG: "auto-eng",
	QA: "qa",
	DEVOPS: "devops",
	TECH_WRITER: "tech-writer",
	CUST_SERVICE: "cust-service",
	SALES: "sales",
	DISPATCHER: "dispatcher",
	ESTIMATOR: "estimator",
	MARKETING: "marketing",
	FLEET: "fleet",
	HR: "hr",
} as const;

type AgentId = (typeof AGENT_IDS)[keyof typeof AGENT_IDS];

const TASK_TYPES = [
	"CODING", "REASONING", "CONTENT", "RESEARCH", "COMMUNICATION",
	"FINANCE", "OPERATIONS", "STRATEGY", "ROUTING_ONLY",
] as const;
type TaskType = (typeof TASK_TYPES)[number];

const PRIORITIES = ["CRITICAL", "URGENT", "NORMAL", "LOW"] as const;
type Priority = (typeof PRIORITIES)[number];

const TIERS = ["T1", "T2", "T3"] as const;
type Tier = (typeof TIERS)[number];

const PHASES = ["coding", "reasoning", "any"] as const;
type Phase = (typeof PHASES)[number];

type BusinessUnit = "automagic" | "chemdry" | "cross";

// Priority mapping: orchestrator priorities → existing schema priorities
const PRIORITY_MAP: Record<Priority, "urgent" | "high" | "medium" | "low"> = {
	CRITICAL: "urgent",
	URGENT: "high",
	NORMAL: "medium",
	LOW: "low",
};

// Model assignments per agent
const AGENT_CONFIG: Record<
	AgentId,
	{
		model: string;
		tier: Tier;
		phase: Phase;
		fallback?: string;
		fallbackTier?: Tier;
	}
> = {
	orchestrator: { model: "gpt-4o-mini", tier: "T2", phase: "any" },
	"exec-sec": { model: "gemini-2.0-flash", tier: "T2", phase: "any" },
	research: { model: "deepseek-r1", tier: "T2", phase: "any" },
	finance: { model: "phi-4:14b", tier: "T3", phase: "reasoning" },
	architect: { model: "claude-opus-4", tier: "T1", phase: "any" },
	"backend-dev": {
		model: "qwen2.5-coder:32b",
		tier: "T3",
		phase: "coding",
		fallback: "claude-sonnet-4",
		fallbackTier: "T2",
	},
	"frontend-dev": { model: "qwen2.5-coder:32b", tier: "T3", phase: "coding" },
	"auto-eng": { model: "qwen2.5-coder:32b", tier: "T3", phase: "coding" },
	qa: { model: "phi-4:14b", tier: "T3", phase: "reasoning" },
	devops: { model: "qwen2.5-coder:32b", tier: "T3", phase: "coding" },
	"tech-writer": { model: "gemini-2.0-flash", tier: "T2", phase: "any" },
	"cust-service": { model: "gemini-2.0-flash", tier: "T2", phase: "any" },
	sales: { model: "claude-sonnet-4", tier: "T2", phase: "any" },
	dispatcher: { model: "phi-4:14b", tier: "T3", phase: "reasoning" },
	estimator: { model: "deepseek-v3", tier: "T2", phase: "any" },
	marketing: { model: "claude-sonnet-4", tier: "T2", phase: "any" },
	fleet: { model: "phi-4:14b", tier: "T3", phase: "reasoning" },
	hr: { model: "deepseek-v3", tier: "T2", phase: "any" },
};

// Opus daily budget
const OPUS_DAILY_BUDGET = 45;
const OPUS_BUDGET_BLOCKS: Record<string, { start: number; end: number; allocation: number }> = {
	morning: { start: 7, end: 9, allocation: 10 },
	midday: { start: 11, end: 13, allocation: 15 },
	afternoon: { start: 15, end: 17, allocation: 10 },
	evening: { start: 19, end: 21, allocation: 10 },
};

// ============================================================
// 1. TASK CLASSIFICATION
// ============================================================

const CLASSIFICATION_RULES: Record<
	TaskType,
	{ keywords: string[]; patterns: RegExp[]; defaultAgents: AgentId[] }
> = {
	CODING: {
		keywords: [
			"code", "build", "implement", "debug", "fix bug", "script",
			"function", "api", "endpoint", "component", "deploy", "refactor",
			"database", "query", "migration", "webhook", "integration",
		],
		patterns: [
			/\b(write|create|build|implement|fix|debug|refactor)\b.*\b(code|function|api|component|script|endpoint)\b/i,
			/\b(typescript|javascript|python|react|node|sql|css|html)\b/i,
		],
		defaultAgents: ["backend-dev", "frontend-dev", "auto-eng", "devops"],
	},
	REASONING: {
		keywords: [
			"analyze", "calculate", "test", "validate", "schedule",
			"optimize", "route", "efficiency", "compare", "evaluate",
		],
		patterns: [
			/\b(analyze|calculate|test|validate|optimize|compare)\b/i,
			/\b(data|numbers|metrics|performance|efficiency)\b/i,
		],
		defaultAgents: ["qa", "finance", "dispatcher", "fleet"],
	},
	CONTENT: {
		keywords: [
			"write", "draft", "copy", "post", "email campaign", "social media",
			"blog", "ad copy", "review response", "documentation",
		],
		patterns: [
			/\b(write|draft|create)\b.*\b(post|copy|email|content|campaign|ad)\b/i,
			/\b(social media|facebook|instagram|linkedin|google business)\b/i,
		],
		defaultAgents: ["marketing", "tech-writer"],
	},
	RESEARCH: {
		keywords: [
			"research", "competitor", "market", "trend", "analysis",
			"investigate", "benchmark", "compare vendors",
		],
		patterns: [
			/\b(research|investigate|benchmark|compare)\b.*\b(market|competitor|vendor|tool|trend)\b/i,
		],
		defaultAgents: ["research"],
	},
	COMMUNICATION: {
		keywords: [
			"email", "reply", "respond", "schedule meeting", "follow up",
			"reminder", "calendar", "reschedule", "confirm",
		],
		patterns: [/\b(email|reply|respond|schedule|follow.up|remind)\b/i],
		defaultAgents: ["exec-sec"],
	},
	FINANCE: {
		keywords: [
			"expense", "invoice", "budget", "p&l", "profit", "cost",
			"revenue", "pricing", "quote", "estimate", "roi",
		],
		patterns: [
			/\b(expense|invoice|budget|profit|cost|revenue|pricing|quote)\b/i,
			/\$\d+/,
		],
		defaultAgents: ["finance", "estimator"],
	},
	OPERATIONS: {
		keywords: [
			"dispatch", "schedule crew", "assign job", "route", "fleet",
			"maintenance", "onboard", "hire", "train", "policy",
		],
		patterns: [
			/\b(dispatch|crew|assign|fleet|maintenance|onboard|hire|train)\b/i,
		],
		defaultAgents: ["dispatcher", "fleet", "hr"],
	},
	STRATEGY: {
		keywords: [
			"strategy", "architecture", "decision", "expand", "launch",
			"pivot", "roadmap", "franchise", "package", "pricing strategy",
		],
		patterns: [
			/\b(strategy|architecture|decision|roadmap|expand|launch)\b/i,
			/\b(should we|what if|long.term|big picture)\b/i,
		],
		defaultAgents: ["architect"],
	},
	ROUTING_ONLY: {
		keywords: [],
		patterns: [],
		defaultAgents: ["orchestrator"],
	},
};

function classifyTask(instruction: string): {
	taskType: TaskType;
	confidence: number;
} {
	const scores: Partial<Record<TaskType, number>> = {};

	for (const [type, rules] of Object.entries(CLASSIFICATION_RULES)) {
		let score = 0;
		const lowerInstruction = instruction.toLowerCase();

		for (const keyword of rules.keywords) {
			if (lowerInstruction.includes(keyword.toLowerCase())) {
				score += 1;
			}
		}

		for (const pattern of rules.patterns) {
			if (pattern.test(instruction)) {
				score += 2;
			}
		}

		if (score > 0) {
			scores[type as TaskType] = score;
		}
	}

	if (Object.keys(scores).length === 0) {
		return { taskType: "ROUTING_ONLY", confidence: 0.3 };
	}

	const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
	const [bestType, bestScore] = sorted[0];
	const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

	return {
		taskType: bestType as TaskType,
		confidence: bestScore / (totalScore + 1),
	};
}

// ============================================================
// 2. AGENT ROUTING
// ============================================================

function routeTask(
	taskType: TaskType,
	_businessUnit: BusinessUnit,
	instruction: string,
	_priority: Priority,
): {
	agentId: AgentId;
	phase: Phase;
	escalationPath: AgentId[];
	rationale: string;
} {
	if (taskType === "STRATEGY") {
		return {
			agentId: "architect",
			phase: "any",
			escalationPath: [],
			rationale: "Strategic decision requires Lead Architect",
		};
	}

	if (taskType === "CODING") {
		if (/\b(react|component|ui|ux|frontend|css|tailwind|layout|dashboard)\b/i.test(instruction)) {
			return { agentId: "frontend-dev", phase: "coding", escalationPath: ["backend-dev", "architect"], rationale: "Frontend/UI task" };
		}
		if (/\b(zapier|ghl|gohighlevel|workflow|automation|webhook|integration|zap)\b/i.test(instruction)) {
			return { agentId: "auto-eng", phase: "coding", escalationPath: ["backend-dev", "architect"], rationale: "Automation/integration task" };
		}
		if (/\b(deploy|ci.?cd|docker|server|infra|nginx|ssl|env|ollama|pipeline)\b/i.test(instruction)) {
			return { agentId: "devops", phase: "coding", escalationPath: ["backend-dev", "architect"], rationale: "Infrastructure/deployment task" };
		}
		return { agentId: "backend-dev", phase: "coding", escalationPath: ["architect"], rationale: "General backend/coding task" };
	}

	if (taskType === "REASONING") {
		if (/\b(test|qa|bug|validation|verify|review code)\b/i.test(instruction)) {
			return { agentId: "qa", phase: "reasoning", escalationPath: ["backend-dev", "architect"], rationale: "QA/testing task" };
		}
		if (/\b(schedule|dispatch|crew|assign|route|calendar)\b/i.test(instruction)) {
			return { agentId: "dispatcher", phase: "reasoning", escalationPath: ["architect"], rationale: "Scheduling/dispatch task" };
		}
		if (/\b(fleet|fuel|driver|vehicle|maintenance|mile)\b/i.test(instruction)) {
			return { agentId: "fleet", phase: "reasoning", escalationPath: ["finance", "architect"], rationale: "Fleet management task" };
		}
		return { agentId: "finance", phase: "reasoning", escalationPath: ["architect"], rationale: "Financial/analytical reasoning task" };
	}

	if (taskType === "CONTENT") {
		if (/\b(doc|readme|api doc|technical|documentation)\b/i.test(instruction)) {
			return { agentId: "tech-writer", phase: "any", escalationPath: ["marketing"], rationale: "Technical documentation" };
		}
		return { agentId: "marketing", phase: "any", escalationPath: ["architect"], rationale: "Marketing/creative content" };
	}

	if (taskType === "RESEARCH") {
		return { agentId: "research", phase: "any", escalationPath: ["architect"], rationale: "Research and analysis task" };
	}

	if (taskType === "COMMUNICATION") {
		return { agentId: "exec-sec", phase: "any", escalationPath: ["sales", "architect"], rationale: "Communication/scheduling task" };
	}

	if (taskType === "FINANCE") {
		if (/\b(quote|estimate|pricing|sq.?ft|square foot)\b/i.test(instruction)) {
			return { agentId: "estimator", phase: "any", escalationPath: ["finance", "architect"], rationale: "Quoting/estimation task" };
		}
		return { agentId: "finance", phase: "reasoning", escalationPath: ["architect"], rationale: "Financial analysis task" };
	}

	if (taskType === "OPERATIONS") {
		if (/\b(onboard|hire|train|policy|hr|employee)\b/i.test(instruction)) {
			return { agentId: "hr", phase: "any", escalationPath: ["architect"], rationale: "HR/training task" };
		}
		if (/\b(dispatch|schedule|crew|assign|job)\b/i.test(instruction)) {
			return { agentId: "dispatcher", phase: "reasoning", escalationPath: ["architect"], rationale: "Operations/dispatch task" };
		}
		if (/\b(fleet|fuel|vehicle|maintenance)\b/i.test(instruction)) {
			return { agentId: "fleet", phase: "reasoning", escalationPath: ["architect"], rationale: "Fleet operations task" };
		}
		if (/\b(customer|complaint|review|feedback|chat|sms)\b/i.test(instruction)) {
			if (/\b(lead|sale|convert|close|upsell|follow.up)\b/i.test(instruction)) {
				return { agentId: "sales", phase: "any", escalationPath: ["architect"], rationale: "Sales/lead qualification (revenue-critical)" };
			}
			return { agentId: "cust-service", phase: "any", escalationPath: ["sales", "architect"], rationale: "Customer service task" };
		}
		return { agentId: "dispatcher", phase: "reasoning", escalationPath: ["architect"], rationale: "General operations task" };
	}

	// Fallback
	return { agentId: "exec-sec", phase: "any", escalationPath: ["architect"], rationale: "Unclassified task - defaulting to Executive Secretary" };
}

// ============================================================
// 3. PHASE SCHEDULER
// ============================================================

function evaluatePhaseSwap(
	taskPhase: Phase,
	currentPhase: string,
	taskPriority: Priority,
	queuedCoding: number,
	queuedReasoning: number,
): {
	action: "run_now" | "queue" | "swap_and_run";
	reason: string;
} {
	if (taskPhase === "any") {
		return { action: "run_now", reason: "API model - no phase constraint" };
	}

	if (taskPhase === currentPhase) {
		return { action: "run_now", reason: "Matches current phase" };
	}

	if (taskPriority === "CRITICAL") {
		return { action: "swap_and_run", reason: "CRITICAL priority overrides phase batching" };
	}

	const currentQueueSize = currentPhase === "coding" ? queuedCoding : queuedReasoning;
	if (taskPriority === "URGENT" && currentQueueSize === 0) {
		return { action: "swap_and_run", reason: "URGENT task and current phase queue is empty" };
	}

	return {
		action: "queue",
		reason: `Queued for ${taskPhase} phase. Current: ${currentPhase}. Pending in current phase: ${currentQueueSize}`,
	};
}

// ============================================================
// 4. ESCALATION MANAGER
// ============================================================

function handleEscalation(
	failedAgentId: AgentId,
	escalationPath: AgentId[],
	currentAttempt: number,
	_maxTierAttempted: Tier,
	failureReason: string,
	opusUsedToday: number,
): {
	nextAgent: AgentId | null;
	requiresEscalationTemplate: boolean;
	action: "escalate" | "queue_for_opus" | "fail_task";
	reason: string;
} {
	if (currentAttempt < escalationPath.length) {
		const nextAgent = escalationPath[currentAttempt];

		if (nextAgent === "architect") {
			if (opusUsedToday >= OPUS_DAILY_BUDGET) {
				return {
					nextAgent: null,
					requiresEscalationTemplate: false,
					action: "fail_task",
					reason: "Opus daily budget exhausted. Task queued for tomorrow or manual intervention.",
				};
			}

			const hour = new Date().getHours();
			const isStrictMode = opusUsedToday > OPUS_DAILY_BUDGET * 0.5 && hour < 12;

			if (isStrictMode) {
				return {
					nextAgent: "architect",
					requiresEscalationTemplate: true,
					action: "queue_for_opus",
					reason: "STRICT MODE: Opus budget >50% consumed before noon. Only CRITICAL escalations.",
				};
			}

			return {
				nextAgent: "architect",
				requiresEscalationTemplate: true,
				action: "queue_for_opus",
				reason: "Escalating to Lead Architect. Escalation template required.",
			};
		}

		return {
			nextAgent,
			requiresEscalationTemplate: false,
			action: "escalate",
			reason: `Escalating from ${failedAgentId} to ${nextAgent}. Reason: ${failureReason}`,
		};
	}

	return {
		nextAgent: null,
		requiresEscalationTemplate: false,
		action: "fail_task",
		reason: `All escalation options exhausted for task. Last failure: ${failureReason}`,
	};
}

function formatEscalationTemplate(
	task: { instruction: string; escalationHistory: string[]; context?: any },
	failureReason: string,
	optionsConsidered: string[],
): string {
	return `TASK: ${task.instruction}

CONTEXT:
${task.escalationHistory.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}

WHAT FAILED / WHY ESCALATING: ${failureReason}

OPTIONS CONSIDERED:
${optionsConsidered.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}

DECISION NEEDED: Based on the above context and failed attempts, what is the correct approach?

ATTACHMENTS: ${task.context ? "[Context data attached]" : "[None]"}`;
}

// ============================================================
// 5. OPUS BUDGET TRACKER
// ============================================================

function getOpusBudgetStatus(usedToday: number): {
	used: number;
	remaining: number;
	percentUsed: number;
	isStrictMode: boolean;
	currentBlock: string;
	blockBudget: number;
	recommendation: string;
} {
	const hour = new Date().getHours();
	const remaining = OPUS_DAILY_BUDGET - usedToday;
	const percentUsed = (usedToday / OPUS_DAILY_BUDGET) * 100;
	const isStrictMode = percentUsed > 50 && hour < 12;

	let currentBlock = "off-hours";
	let blockBudget = 0;
	for (const [name, block] of Object.entries(OPUS_BUDGET_BLOCKS)) {
		if (hour >= block.start && hour < block.end) {
			currentBlock = name;
			blockBudget = block.allocation;
			break;
		}
	}

	let recommendation = "Normal operation";
	if (isStrictMode) {
		recommendation = "STRICT MODE: Only CRITICAL escalations to Opus";
	} else if (remaining <= 5) {
		recommendation = "LOW BUDGET: Reserve remaining for critical decisions only";
	} else if (remaining <= 15) {
		recommendation = "MODERATE: Be selective with Opus usage for remainder of day";
	}

	return {
		used: usedToday,
		remaining,
		percentUsed: Math.round(percentUsed),
		isStrictMode,
		currentBlock,
		blockBudget,
		recommendation,
	};
}

// ============================================================
// 6. CONVEX MUTATIONS & QUERIES
// ============================================================

/**
 * Submit a new task to the system.
 * Primary entry point for orchestrated work.
 * Maps orchestrator concepts to existing schema fields.
 */
export const submitTask = mutation({
	args: {
		instruction: v.string(),
		businessUnit: v.string(),
		priority: v.optional(v.string()),
		context: v.optional(v.any()),
		constraints: v.optional(v.array(v.string())),
		fromAgent: v.optional(v.string()),
		deadline: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId || "default";

		// 1. Classify
		const classification = classifyTask(args.instruction);

		// 2. Determine priority
		const priority = (args.priority as Priority) || "NORMAL";

		// 3. Route
		const routing = routeTask(
			classification.taskType,
			(args.businessUnit as BusinessUnit) || "cross",
			args.instruction,
			priority,
		);

		// 4. Check phase scheduling
		const phaseState = await ctx.db
			.query("phaseState")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.first();
		const currentPhase = phaseState?.currentPhase || "coding";
		const phaseDecision = evaluatePhaseSwap(
			routing.phase,
			currentPhase,
			priority,
			phaseState?.queuedCoding || 0,
			phaseState?.queuedReasoning || 0,
		);

		// 5. Resolve agent routingId → Convex agent doc
		const agentDoc = await ctx.db
			.query("agents")
			.withIndex("by_tenant_routingId", (q) =>
				q.eq("tenantId", tenantId).eq("routingId", routing.agentId),
			)
			.first();

		// Map orchestrator status to existing schema
		const status = phaseDecision.action === "queue" ? "inbox" : "assigned";

		// 6. Create task using existing schema fields
		const taskId = await ctx.db.insert("tasks", {
			title: args.instruction.substring(0, 120),
			description: args.instruction,
			status,
			assigneeIds: agentDoc ? [agentDoc._id] : [],
			tags: [classification.taskType.toLowerCase(), args.businessUnit || "cross"],
			priority: PRIORITY_MAP[priority],
			source: "agent" as const,
			tenantId,
			taskType: classification.taskType,
			businessUnit: args.businessUnit || "cross",
			phase: routing.phase,
			fromAgent: args.fromAgent || "user",
			constraints: args.constraints,
			maxTierAttempted: AGENT_CONFIG[routing.agentId].tier,
			escalationAttempts: 0,
			classificationConfidence: classification.confidence,
			deadline: args.deadline,
			escalationHistory: [],
		});

		// 7. Update phase queue counts
		if (routing.phase !== "any" && phaseState) {
			const updates: Record<string, number> = {};
			if (routing.phase === "coding") {
				updates.queuedCoding = (phaseState.queuedCoding || 0) + 1;
			} else {
				updates.queuedReasoning = (phaseState.queuedReasoning || 0) + 1;
			}
			await ctx.db.patch(phaseState._id, updates);
		}

		return {
			taskId,
			classification: classification.taskType,
			confidence: classification.confidence,
			assignedTo: routing.agentId,
			assignedAgentName: agentDoc?.name || routing.agentId,
			phase: routing.phase,
			phaseAction: phaseDecision.action,
			phaseReason: phaseDecision.reason,
			escalationPath: routing.escalationPath,
			rationale: routing.rationale,
			mappedPriority: PRIORITY_MAP[priority],
			mappedStatus: status,
		};
	},
});

/**
 * Report task completion or failure from an agent.
 * Handles escalation logic when tasks fail.
 */
export const reportTaskResult = mutation({
	args: {
		taskId: v.id("tasks"),
		status: v.string(), // "completed" | "failed"
		result: v.optional(v.any()),
		failureReason: v.optional(v.string()),
		optionsConsidered: v.optional(v.array(v.string())),
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId || "default";
		const task = await ctx.db.get(args.taskId);
		if (!task) throw new Error("Task not found");

		if (args.status === "completed") {
			await ctx.db.patch(args.taskId, {
				status: "done" as const,
				result: args.result,
				completedAt: Date.now(),
			});
			return { action: "completed", taskId: args.taskId };
		}

		if (args.status === "failed") {
			// Get Opus usage for today
			const today = new Date().toISOString().split("T")[0];
			const opusUsage = await ctx.db
				.query("opusUsage")
				.withIndex("by_tenant_date", (q) =>
					q.eq("tenantId", tenantId).eq("date", today),
				)
				.first();
			const opusUsedToday = opusUsage?.count || 0;

			// Re-route to get escalation path
			const taskType = (task.taskType || "ROUTING_ONLY") as TaskType;
			const businessUnit = (task.businessUnit || "cross") as BusinessUnit;
			const instruction = task.description || task.title;
			const taskPriority = task.priority === "urgent" ? "CRITICAL" :
				task.priority === "high" ? "URGENT" :
				task.priority === "low" ? "LOW" : "NORMAL";

			const routing = routeTask(taskType, businessUnit, instruction, taskPriority as Priority);

			// Determine the failed agent's routingId
			let failedAgentRoutingId: AgentId = "orchestrator";
			if (task.assigneeIds && task.assigneeIds.length > 0) {
				const assignedAgent = await ctx.db.get(task.assigneeIds[0]);
				if (assignedAgent?.routingId) {
					failedAgentRoutingId = assignedAgent.routingId as AgentId;
				}
			}

			const escalation = handleEscalation(
				failedAgentRoutingId,
				routing.escalationPath,
				task.escalationAttempts || 0,
				(task.maxTierAttempted || "T3") as Tier,
				args.failureReason || "Unknown failure",
				opusUsedToday,
			);

			// Build escalation history entry
			const historyEntry = {
				agentId: failedAgentRoutingId,
				model: AGENT_CONFIG[failedAgentRoutingId]?.model,
				timestamp: Date.now(),
				status: "failed",
				reason: args.failureReason || "Unknown failure",
			};
			const newHistory = [...(task.escalationHistory || []), historyEntry];

			if (escalation.action === "fail_task") {
				await ctx.db.patch(args.taskId, {
					status: "archived" as const,
					escalationHistory: newHistory,
					result: { error: escalation.reason },
					completedAt: Date.now(),
				});
				return { action: "failed", reason: escalation.reason };
			}

			// Resolve next agent
			const nextAgentDoc = await ctx.db
				.query("agents")
				.withIndex("by_tenant_routingId", (q) =>
					q.eq("tenantId", tenantId).eq("routingId", escalation.nextAgent!),
				)
				.first();

			// Build new description if escalation template needed
			let newDescription = task.description;
			if (escalation.requiresEscalationTemplate) {
				const histStrings = newHistory.map(
					(h) => `[${h.agentId}] ${h.status}: ${h.reason || "no reason"}`,
				);
				newDescription = formatEscalationTemplate(
					{ instruction: task.description, escalationHistory: histStrings, context: task.result },
					args.failureReason || "Unknown failure",
					args.optionsConsidered || [],
				);
			}

			await ctx.db.patch(args.taskId, {
				assigneeIds: nextAgentDoc ? [nextAgentDoc._id] : task.assigneeIds,
				status: "assigned" as const,
				description: newDescription,
				escalationAttempts: (task.escalationAttempts || 0) + 1,
				escalationHistory: newHistory,
				maxTierAttempted: AGENT_CONFIG[escalation.nextAgent!]?.tier || task.maxTierAttempted,
			});

			// Track Opus usage if escalating to architect
			if (escalation.nextAgent === "architect") {
				if (opusUsage) {
					await ctx.db.patch(opusUsage._id, {
						count: opusUsedToday + 1,
						log: [
							...opusUsage.log,
							{
								taskId: args.taskId,
								timestamp: Date.now(),
								category: task.taskType || "unknown",
								summary: (task.description || task.title).substring(0, 100),
							},
						],
					});
				} else {
					await ctx.db.insert("opusUsage", {
						date: today,
						count: 1,
						log: [
							{
								taskId: args.taskId,
								timestamp: Date.now(),
								category: task.taskType || "unknown",
								summary: (task.description || task.title).substring(0, 100),
							},
						],
						tenantId,
					});
				}
			}

			return {
				action: "escalated",
				nextAgent: escalation.nextAgent,
				nextAgentName: nextAgentDoc?.name || escalation.nextAgent,
				reason: escalation.reason,
			};
		}

		throw new Error(`Unknown status: ${args.status}`);
	},
});

/**
 * Get phase queue counts for auto-swap decisions.
 */
export const getPhaseQueueCounts = query({
	args: {
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId || "default";

		const codingTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant_phase_status", (q) =>
				q.eq("tenantId", tenantId).eq("phase", "coding").eq("status", "inbox"),
			)
			.collect();

		const reasoningTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant_phase_status", (q) =>
				q.eq("tenantId", tenantId).eq("phase", "reasoning").eq("status", "inbox"),
			)
			.collect();

		return {
			queuedCoding: codingTasks.length,
			queuedReasoning: reasoningTasks.length,
		};
	},
});

/**
 * Get Opus budget dashboard.
 */
export const getOpusDashboard = query({
	args: {
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId || "default";
		const today = new Date().toISOString().split("T")[0];
		const opusUsage = await ctx.db
			.query("opusUsage")
			.withIndex("by_tenant_date", (q) =>
				q.eq("tenantId", tenantId).eq("date", today),
			)
			.first();

		const budgetStatus = getOpusBudgetStatus(opusUsage?.count || 0);

		return {
			...budgetStatus,
			todayLog: opusUsage?.log || [],
			dailyBudget: OPUS_DAILY_BUDGET,
			budgetBlocks: OPUS_BUDGET_BLOCKS,
		};
	},
});

/**
 * Get system-wide dashboard data via orchestrator lens.
 */
export const getSystemDashboard = query({
	args: {
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId || "default";

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const activeTasks = allTasks.filter(
			(t) => t.status === "assigned" || t.status === "in_progress",
		);
		const queuedTasks = allTasks.filter((t) => t.status === "inbox");
		const criticalTasks = activeTasks.filter((t) => t.priority === "urgent");

		// Build agent load map
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const agentLoad: Record<string, { name: string; routingId: string; activeTasks: number }> = {};
		for (const agent of agents) {
			if (agent.routingId) {
				agentLoad[agent.routingId] = {
					name: agent.name,
					routingId: agent.routingId,
					activeTasks: 0,
				};
			}
		}

		for (const task of activeTasks) {
			if (task.assigneeIds && task.assigneeIds.length > 0) {
				const agent = agents.find((a) => a._id === task.assigneeIds[0]);
				if (agent?.routingId && agentLoad[agent.routingId]) {
					agentLoad[agent.routingId].activeTasks++;
				}
			}
		}

		return {
			active: activeTasks.length,
			queued: queuedTasks.length,
			critical: criticalTasks.length,
			agentLoad,
			totalAgents: agents.length,
			enabledAgents: agents.filter((a) => a.status !== "off").length,
		};
	},
});
