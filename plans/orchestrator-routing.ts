// ============================================================
// OpenClaw Orchestrator - Routing Logic for Convex Backend
// ============================================================
// This module handles task classification, agent routing,
// escalation management, phase scheduling, and Opus budget tracking.
// ============================================================

import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

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

export const TASK_TYPES = [
  "CODING",
  "REASONING",
  "CONTENT",
  "RESEARCH",
  "COMMUNICATION",
  "FINANCE",
  "OPERATIONS",
  "STRATEGY",
  "ROUTING_ONLY",
] as const;

type TaskType = (typeof TASK_TYPES)[number];

export const PRIORITIES = ["CRITICAL", "URGENT", "NORMAL", "LOW"] as const;
type Priority = (typeof PRIORITIES)[number];

export const TIERS = ["T1", "T2", "T3"] as const;
type Tier = (typeof TIERS)[number];

export const PHASES = ["coding", "reasoning", "any"] as const;
type Phase = (typeof PHASES)[number];

export const BUSINESS_UNITS = ["automagic", "chemdry", "cross"] as const;
type BusinessUnit = (typeof BUSINESS_UNITS)[number];

// Model assignments per agent
const AGENT_CONFIG: Record<
  AgentId,
  {
    model: string;
    tier: Tier;
    phase: Phase;
    fallback?: string; // fallback model if primary fails
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
const OPUS_BUDGET_BLOCKS = {
  morning: { start: 7, end: 9, allocation: 10 },
  midday: { start: 11, end: 13, allocation: 15 },
  afternoon: { start: 15, end: 17, allocation: 10 },
  evening: { start: 19, end: 21, allocation: 10 },
};

// ============================================================
// SCHEMA: Task Queue
// ============================================================
// Define in your schema.ts:
//
// tasks: defineTable({
//   fromAgent: v.string(),
//   toAgent: v.string(),
//   priority: v.string(),
//   businessUnit: v.string(),
//   taskType: v.string(),
//   phase: v.string(),
//   instruction: v.string(),
//   context: v.optional(v.any()),
//   constraints: v.optional(v.array(v.string())),
//   escalationAttempts: v.number(),
//   escalationHistory: v.array(v.string()),
//   maxTierAttempted: v.string(),
//   status: v.string(), // "queued" | "active" | "completed" | "failed" | "escalated"
//   result: v.optional(v.any()),
//   createdAt: v.number(),
//   deadline: v.optional(v.number()),
//   dependsOn: v.optional(v.array(v.id("tasks"))),
//   completedAt: v.optional(v.number()),
// })
//   .index("by_status", ["status"])
//   .index("by_agent_status", ["toAgent", "status"])
//   .index("by_phase_status", ["phase", "status"])
//   .index("by_priority_status", ["priority", "status"]),
//
// opusUsage: defineTable({
//   date: v.string(), // YYYY-MM-DD
//   count: v.number(),
//   log: v.array(v.object({
//     taskId: v.id("tasks"),
//     timestamp: v.number(),
//     category: v.string(),
//     summary: v.string(),
//   })),
// }).index("by_date", ["date"]),
//
// phaseState: defineTable({
//   currentPhase: v.string(), // "coding" | "reasoning"
//   lastSwap: v.number(),
//   queuedCoding: v.number(),
//   queuedReasoning: v.number(),
// }),

// ============================================================
// 1. TASK CLASSIFICATION
// ============================================================

/**
 * Classification keywords and patterns for routing.
 * The Orchestrator agent (GPT-4o-mini) uses these as a reference,
 * but the actual classification happens in the LLM call.
 * This serves as the fallback/validation layer.
 */
const CLASSIFICATION_RULES: Record<
  TaskType,
  {
    keywords: string[];
    patterns: RegExp[];
    defaultAgents: AgentId[];
  }
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
    patterns: [
      /\b(email|reply|respond|schedule|follow.up|remind)\b/i,
    ],
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

/**
 * Classify a task based on instruction text.
 * Returns best-guess classification. The Orchestrator LLM refines this.
 */
function classifyTask(instruction: string): {
  taskType: TaskType;
  confidence: number;
} {
  const scores: Partial<Record<TaskType, number>> = {};

  for (const [type, rules] of Object.entries(CLASSIFICATION_RULES)) {
    let score = 0;
    const lowerInstruction = instruction.toLowerCase();

    // Keyword matching
    for (const keyword of rules.keywords) {
      if (lowerInstruction.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Pattern matching (weighted higher)
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
    confidence: bestScore / (totalScore + 1), // normalize
  };
}

// ============================================================
// 2. AGENT ROUTING
// ============================================================

/**
 * Determine which agent should handle a task.
 * Uses task type, business unit, and specific context clues.
 */
function routeTask(
  taskType: TaskType,
  businessUnit: BusinessUnit,
  instruction: string,
  priority: Priority
): {
  agentId: AgentId;
  phase: Phase;
  escalationPath: AgentId[];
  rationale: string;
} {
  const lowerInstruction = instruction.toLowerCase();

  // --- STRATEGY always goes to Architect (via escalation prep) ---
  if (taskType === "STRATEGY") {
    return {
      agentId: "architect",
      phase: "any",
      escalationPath: [],
      rationale: "Strategic decision requires Lead Architect",
    };
  }

  // --- CODING tasks: sub-route by domain ---
  if (taskType === "CODING") {
    // Frontend signals
    if (
      /\b(react|component|ui|ux|frontend|css|tailwind|layout|dashboard)\b/i.test(
        instruction
      )
    ) {
      return {
        agentId: "frontend-dev",
        phase: "coding",
        escalationPath: ["backend-dev", "architect"],
        rationale: "Frontend/UI task",
      };
    }

    // Automation/integration signals
    if (
      /\b(zapier|ghl|gohighlevel|workflow|automation|webhook|integration|zap)\b/i.test(
        instruction
      )
    ) {
      return {
        agentId: "auto-eng",
        phase: "coding",
        escalationPath: ["backend-dev", "architect"],
        rationale: "Automation/integration task",
      };
    }

    // DevOps signals
    if (
      /\b(deploy|ci.?cd|docker|server|infra|nginx|ssl|env|ollama|pipeline)\b/i.test(
        instruction
      )
    ) {
      return {
        agentId: "devops",
        phase: "coding",
        escalationPath: ["backend-dev", "architect"],
        rationale: "Infrastructure/deployment task",
      };
    }

    // Default coding -> Backend Dev
    return {
      agentId: "backend-dev",
      phase: "coding",
      escalationPath: ["architect"],
      rationale: "General backend/coding task",
    };
  }

  // --- REASONING tasks: sub-route by domain ---
  if (taskType === "REASONING") {
    if (/\b(test|qa|bug|validation|verify|review code)\b/i.test(instruction)) {
      return {
        agentId: "qa",
        phase: "reasoning",
        escalationPath: ["backend-dev", "architect"],
        rationale: "QA/testing task",
      };
    }

    if (/\b(schedule|dispatch|crew|assign|route|calendar)\b/i.test(instruction)) {
      return {
        agentId: "dispatcher",
        phase: "reasoning",
        escalationPath: ["architect"],
        rationale: "Scheduling/dispatch task",
      };
    }

    if (/\b(fleet|fuel|driver|vehicle|maintenance|mile)\b/i.test(instruction)) {
      return {
        agentId: "fleet",
        phase: "reasoning",
        escalationPath: ["finance", "architect"],
        rationale: "Fleet management task",
      };
    }

    // Default reasoning -> Finance
    return {
      agentId: "finance",
      phase: "reasoning",
      escalationPath: ["architect"],
      rationale: "Financial/analytical reasoning task",
    };
  }

  // --- CONTENT tasks ---
  if (taskType === "CONTENT") {
    if (/\b(doc|readme|api doc|technical|documentation)\b/i.test(instruction)) {
      return {
        agentId: "tech-writer",
        phase: "any",
        escalationPath: ["marketing"],
        rationale: "Technical documentation",
      };
    }

    return {
      agentId: "marketing",
      phase: "any",
      escalationPath: ["architect"],
      rationale: "Marketing/creative content",
    };
  }

  // --- RESEARCH ---
  if (taskType === "RESEARCH") {
    return {
      agentId: "research",
      phase: "any",
      escalationPath: ["architect"],
      rationale: "Research and analysis task",
    };
  }

  // --- COMMUNICATION ---
  if (taskType === "COMMUNICATION") {
    return {
      agentId: "exec-sec",
      phase: "any",
      escalationPath: ["sales", "architect"],
      rationale: "Communication/scheduling task",
    };
  }

  // --- FINANCE ---
  if (taskType === "FINANCE") {
    if (/\b(quote|estimate|pricing|sq.?ft|square foot)\b/i.test(instruction)) {
      return {
        agentId: "estimator",
        phase: "any",
        escalationPath: ["finance", "architect"],
        rationale: "Quoting/estimation task",
      };
    }

    return {
      agentId: "finance",
      phase: "reasoning",
      escalationPath: ["architect"],
      rationale: "Financial analysis task",
    };
  }

  // --- OPERATIONS ---
  if (taskType === "OPERATIONS") {
    if (/\b(onboard|hire|train|policy|hr|employee)\b/i.test(instruction)) {
      return {
        agentId: "hr",
        phase: "any",
        escalationPath: ["architect"],
        rationale: "HR/training task",
      };
    }

    if (/\b(dispatch|schedule|crew|assign|job)\b/i.test(instruction)) {
      return {
        agentId: "dispatcher",
        phase: "reasoning",
        escalationPath: ["architect"],
        rationale: "Operations/dispatch task",
      };
    }

    if (/\b(fleet|fuel|vehicle|maintenance)\b/i.test(instruction)) {
      return {
        agentId: "fleet",
        phase: "reasoning",
        escalationPath: ["architect"],
        rationale: "Fleet operations task",
      };
    }

    // Customer-facing operations
    if (/\b(customer|complaint|review|feedback|chat|sms)\b/i.test(instruction)) {
      if (/\b(lead|sale|convert|close|upsell|follow.up)\b/i.test(instruction)) {
        return {
          agentId: "sales",
          phase: "any",
          escalationPath: ["architect"],
          rationale: "Sales/lead qualification (revenue-critical)",
        };
      }
      return {
        agentId: "cust-service",
        phase: "any",
        escalationPath: ["sales", "architect"],
        rationale: "Customer service task",
      };
    }

    return {
      agentId: "dispatcher",
      phase: "reasoning",
      escalationPath: ["architect"],
      rationale: "General operations task",
    };
  }

  // Fallback
  return {
    agentId: "exec-sec",
    phase: "any",
    escalationPath: ["architect"],
    rationale: "Unclassified task - defaulting to Executive Secretary",
  };
}

// ============================================================
// 3. PHASE SCHEDULER
// ============================================================

/**
 * Determine if a model swap is needed and manage the queue.
 * Returns whether the task can run immediately or must be queued.
 */
function evaluatePhaseSwap(
  taskPhase: Phase,
  currentPhase: string,
  taskPriority: Priority,
  queuedCoding: number,
  queuedReasoning: number
): {
  action: "run_now" | "queue" | "swap_and_run";
  reason: string;
} {
  // "any" phase tasks use API models - always run immediately
  if (taskPhase === "any") {
    return { action: "run_now", reason: "API model - no phase constraint" };
  }

  // Same phase - run immediately
  if (taskPhase === currentPhase) {
    return { action: "run_now", reason: "Matches current phase" };
  }

  // Different phase - check if swap is warranted
  if (taskPriority === "CRITICAL") {
    return {
      action: "swap_and_run",
      reason: "CRITICAL priority overrides phase batching",
    };
  }

  if (taskPriority === "URGENT" && getCurrentPhaseQueueSize(currentPhase, queuedCoding, queuedReasoning) === 0) {
    return {
      action: "swap_and_run",
      reason: "URGENT task and current phase queue is empty",
    };
  }

  // Otherwise queue for next batch
  return {
    action: "queue",
    reason: `Queued for ${taskPhase} phase. Current: ${currentPhase}. Pending in current phase: ${getCurrentPhaseQueueSize(currentPhase, queuedCoding, queuedReasoning)}`,
  };
}

function getCurrentPhaseQueueSize(
  currentPhase: string,
  queuedCoding: number,
  queuedReasoning: number
): number {
  return currentPhase === "coding" ? queuedCoding : queuedReasoning;
}

// ============================================================
// 4. ESCALATION MANAGER
// ============================================================

/**
 * Handle escalation when an agent fails or flags a task.
 */
function handleEscalation(
  failedAgentId: AgentId,
  escalationPath: AgentId[],
  currentAttempt: number,
  maxTierAttempted: Tier,
  failureReason: string,
  opusUsedToday: number
): {
  nextAgent: AgentId | null;
  requiresEscalationTemplate: boolean;
  action: "escalate" | "queue_for_opus" | "fail_task";
  reason: string;
} {
  // Check if there are more agents in the escalation path
  if (currentAttempt < escalationPath.length) {
    const nextAgent = escalationPath[currentAttempt];

    // If next in path is architect (Opus), enforce template and budget
    if (nextAgent === "architect") {
      if (opusUsedToday >= OPUS_DAILY_BUDGET) {
        return {
          nextAgent: null,
          requiresEscalationTemplate: false,
          action: "fail_task",
          reason: "Opus daily budget exhausted. Task queued for tomorrow or manual intervention.",
        };
      }

      // Check if in strict mode (>50% before noon)
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

  // No more agents in path
  return {
    nextAgent: null,
    requiresEscalationTemplate: false,
    action: "fail_task",
    reason: `All escalation options exhausted for task. Last failure: ${failureReason}`,
  };
}

/**
 * Format the escalation template for Opus.
 * This ensures every Opus message is pre-digested.
 */
function formatEscalationTemplate(
  task: {
    instruction: string;
    escalationHistory: string[];
    context?: any;
  },
  failureReason: string,
  optionsConsidered: string[]
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

/**
 * Get current Opus usage for today and check budget status.
 */
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
 * This is the primary entry point for all work.
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
  },
  handler: async (ctx, args) => {
    // 1. Classify
    const classification = classifyTask(args.instruction);

    // 2. Determine priority
    const priority = (args.priority as Priority) || "NORMAL";

    // 3. Route
    const routing = routeTask(
      classification.taskType,
      args.businessUnit as BusinessUnit,
      args.instruction,
      priority
    );

    // 4. Check phase scheduling
    const phaseState = await ctx.db.query("phaseState").first();
    const currentPhase = phaseState?.currentPhase || "coding";
    const phaseDecision = evaluatePhaseSwap(
      routing.phase,
      currentPhase,
      priority,
      phaseState?.queuedCoding || 0,
      phaseState?.queuedReasoning || 0
    );

    // 5. Create task
    const taskId = await ctx.db.insert("tasks", {
      fromAgent: args.fromAgent || "user",
      toAgent: routing.agentId,
      priority,
      businessUnit: args.businessUnit,
      taskType: classification.taskType,
      phase: routing.phase,
      instruction: args.instruction,
      context: args.context,
      constraints: args.constraints,
      escalationAttempts: 0,
      escalationHistory: [],
      maxTierAttempted: AGENT_CONFIG[routing.agentId].tier,
      status: phaseDecision.action === "queue" ? "queued" : "active",
      createdAt: Date.now(),
      deadline: args.deadline,
    });

    // 6. Update phase queue counts
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
      phase: routing.phase,
      phaseAction: phaseDecision.action,
      phaseReason: phaseDecision.reason,
      escalationPath: routing.escalationPath,
      rationale: routing.rationale,
    };
  },
});

/**
 * Report task completion or failure from an agent.
 */
export const reportTaskResult = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.string(), // "completed" | "failed"
    result: v.optional(v.any()),
    failureReason: v.optional(v.string()),
    optionsConsidered: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (args.status === "completed") {
      await ctx.db.patch(args.taskId, {
        status: "completed",
        result: args.result,
        completedAt: Date.now(),
      });
      return { action: "completed", taskId: args.taskId };
    }

    // Task failed - handle escalation
    if (args.status === "failed") {
      // Get Opus usage for today
      const today = new Date().toISOString().split("T")[0];
      const opusUsage = await ctx.db
        .query("opusUsage")
        .withIndex("by_date", (q) => q.eq("date", today))
        .first();
      const opusUsedToday = opusUsage?.count || 0;

      // Parse escalation path from task metadata
      // (In production, store escalationPath on the task)
      const routing = routeTask(
        task.taskType as TaskType,
        task.businessUnit as BusinessUnit,
        task.instruction,
        task.priority as Priority
      );

      const escalation = handleEscalation(
        task.toAgent as AgentId,
        routing.escalationPath,
        task.escalationAttempts,
        task.maxTierAttempted as Tier,
        args.failureReason || "Unknown failure",
        opusUsedToday
      );

      // Update task history
      const newHistory = [
        ...task.escalationHistory,
        `[${task.toAgent}] Failed: ${args.failureReason}`,
      ];

      if (escalation.action === "fail_task") {
        await ctx.db.patch(args.taskId, {
          status: "failed",
          escalationHistory: newHistory,
          result: { error: escalation.reason },
          completedAt: Date.now(),
        });
        return { action: "failed", reason: escalation.reason };
      }

      // Prepare escalation
      let newInstruction = task.instruction;
      if (escalation.requiresEscalationTemplate) {
        newInstruction = formatEscalationTemplate(
          {
            instruction: task.instruction,
            escalationHistory: newHistory,
            context: task.context,
          },
          args.failureReason || "Unknown failure",
          args.optionsConsidered || []
        );
      }

      await ctx.db.patch(args.taskId, {
        toAgent: escalation.nextAgent!,
        status: "active",
        instruction: newInstruction,
        escalationAttempts: task.escalationAttempts + 1,
        escalationHistory: newHistory,
        maxTierAttempted: AGENT_CONFIG[escalation.nextAgent!].tier,
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
                category: task.taskType,
                summary: task.instruction.substring(0, 100),
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
                category: task.taskType,
                summary: task.instruction.substring(0, 100),
              },
            ],
          });
        }
      }

      return {
        action: "escalated",
        nextAgent: escalation.nextAgent,
        reason: escalation.reason,
      };
    }
  },
});

/**
 * Get tasks for a specific agent to process.
 */
export const getAgentTasks = query({
  args: {
    agentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_agent_status", (q) =>
        q.eq("toAgent", args.agentId).eq("status", "active")
      )
      .take(args.limit || 10);
  },
});

/**
 * Get phase queue status for swap decisions.
 */
export const getPhaseStatus = query({
  handler: async (ctx) => {
    const phaseState = await ctx.db.query("phaseState").first();
    if (!phaseState) {
      return {
        currentPhase: "coding",
        queuedCoding: 0,
        queuedReasoning: 0,
        recommendation: "No phase state initialized",
      };
    }

    const shouldSwap =
      phaseState.currentPhase === "coding"
        ? phaseState.queuedCoding === 0 && phaseState.queuedReasoning > 0
        : phaseState.queuedReasoning === 0 && phaseState.queuedCoding > 0;

    return {
      ...phaseState,
      shouldSwap,
      recommendation: shouldSwap
        ? `Swap to ${phaseState.currentPhase === "coding" ? "reasoning" : "coding"} phase`
        : `Stay in ${phaseState.currentPhase} phase`,
    };
  },
});

/**
 * Trigger phase swap (called by DevOps scripts or scheduler).
 */
export const swapPhase = mutation({
  args: {
    targetPhase: v.string(),
  },
  handler: async (ctx, args) => {
    const phaseState = await ctx.db.query("phaseState").first();
    if (phaseState) {
      await ctx.db.patch(phaseState._id, {
        currentPhase: args.targetPhase,
        lastSwap: Date.now(),
      });
    } else {
      await ctx.db.insert("phaseState", {
        currentPhase: args.targetPhase,
        lastSwap: Date.now(),
        queuedCoding: 0,
        queuedReasoning: 0,
      });
    }

    // Activate queued tasks for the new phase
    const queuedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_phase_status", (q) =>
        q.eq("phase", args.targetPhase).eq("status", "queued")
      )
      .collect();

    for (const task of queuedTasks) {
      await ctx.db.patch(task._id, { status: "active" });
    }

    return {
      newPhase: args.targetPhase,
      activatedTasks: queuedTasks.length,
    };
  },
});

/**
 * Get Opus budget dashboard.
 */
export const getOpusDashboard = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const opusUsage = await ctx.db
      .query("opusUsage")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    return getOpusBudgetStatus(opusUsage?.count || 0);
  },
});

/**
 * Get system-wide task dashboard.
 */
export const getSystemDashboard = query({
  handler: async (ctx) => {
    const activeTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const queuedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    const agentLoad: Record<string, number> = {};
    for (const task of activeTasks) {
      agentLoad[task.toAgent] = (agentLoad[task.toAgent] || 0) + 1;
    }

    return {
      active: activeTasks.length,
      queued: queuedTasks.length,
      agentLoad,
      criticalTasks: activeTasks.filter((t) => t.priority === "CRITICAL").length,
      urgentTasks: activeTasks.filter((t) => t.priority === "URGENT").length,
    };
  },
});
