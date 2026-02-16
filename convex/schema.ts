import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
	...authTables,
	agents: defineTable({
		name: v.string(),
		role: v.string(),
		status: v.union(
			v.literal("idle"),
			v.literal("active"),
			v.literal("blocked"),
			v.literal("off"),
		),
		level: v.union(v.literal("LEAD"), v.literal("INT"), v.literal("SPC")),
		avatar: v.string(),
		currentTaskId: v.optional(v.id("tasks")),
		sessionKey: v.optional(v.string()),
		systemPrompt: v.optional(v.string()),
		character: v.optional(v.string()),
		lore: v.optional(v.string()),
		reportsTo: v.optional(v.id("agents")),
		canInteractWith: v.optional(v.union(
			v.literal("any"),
			v.array(v.id("agents")),
		)),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
		businessUnit: v.optional(v.string()),
		category: v.optional(v.string()),
		model: v.optional(v.string()),
		fallbackModel: v.optional(v.string()),
		tier: v.optional(v.string()),
		phase: v.optional(v.string()),
		isEnabled: v.optional(v.boolean()),
		maxConcurrentTasks: v.optional(v.number()),
		agentRole: v.optional(v.string()),  // "manager" | "ic"
		escalationPath: v.optional(v.array(v.string())),
		lastActiveAt: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
		promptHistory: v.optional(v.array(v.object({ prompt: v.string(), savedAt: v.number() }))),
		routingId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_name", ["tenantId", "name"])
		.index("by_tenant_routingId", ["tenantId", "routingId"]),

	projects: defineTable({
		name: v.string(),
		description: v.string(),
		status: v.union(
			v.literal("idea"),
			v.literal("planning"),
			v.literal("active"),
			v.literal("paused"),
			v.literal("review"),
			v.literal("complete"),
			v.literal("archived"),
		),
		area: v.optional(v.union(
			v.literal("chem-dry"),
			v.literal("automagic"),
			v.literal("personal"),
			v.literal("infrastructure"),
		)),
		milestones: v.optional(v.array(v.object({
			name: v.string(),
			targetDate: v.optional(v.number()),
			completedDate: v.optional(v.number()),
		}))),
		borderColor: v.optional(v.string()),
		totalCost: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_status", ["tenantId", "status"]),

	tasks: defineTable({
		title: v.string(),
		description: v.string(),
		status: v.union(
			v.literal("inbox"),
			v.literal("assigned"),
			v.literal("in_progress"),
			v.literal("review"),
			v.literal("done"),
			v.literal("archived"),
		),
		assigneeIds: v.array(v.id("agents")),
		tags: v.array(v.string()),
		borderColor: v.optional(v.string()),
		sessionKey: v.optional(v.string()),
		openclawRunId: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		usedCodingTools: v.optional(v.boolean()),
		// New fields
		projectId: v.optional(v.id("projects")),
		priority: v.optional(v.union(
			v.literal("urgent"),
			v.literal("high"),
			v.literal("medium"),
			v.literal("low"),
		)),
		dueDate: v.optional(v.number()),
		blockedBy: v.optional(v.string()),
		source: v.optional(v.union(
			v.literal("telegram"),
			v.literal("manual"),
			v.literal("heartbeat"),
			v.literal("agent"),
			v.literal("webchat"),
		)),
		needsInput: v.optional(v.boolean()),
		totalCost: v.optional(v.number()),
		totalTokens: v.optional(v.number()),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
		taskType: v.optional(v.string()),
		businessUnit: v.optional(v.string()),
		completedAt: v.optional(v.number()),
		escalationHistory: v.optional(v.array(v.object({
			agentId: v.string(),
			model: v.optional(v.string()),
			timestamp: v.number(),
			duration: v.optional(v.number()),
			status: v.string(),
			reason: v.optional(v.string()),
		}))),
		phase: v.optional(v.string()),
		fromAgent: v.optional(v.string()),
		constraints: v.optional(v.array(v.string())),
		result: v.optional(v.any()),
		maxTierAttempted: v.optional(v.string()),
		escalationAttempts: v.optional(v.number()),
		classificationConfidence: v.optional(v.number()),
		dependsOn: v.optional(v.array(v.id("tasks"))),
		deadline: v.optional(v.number()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_project", ["tenantId", "projectId"])
		.index("by_tenant_status", ["tenantId", "status"])
		.index("by_tenant_phase_status", ["tenantId", "phase", "status"]),

	messages: defineTable({
		taskId: v.id("tasks"),
		fromAgentId: v.id("agents"),
		content: v.string(),
		attachments: v.array(v.id("documents")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_task", ["tenantId", "taskId"]),

	activities: defineTable({
		type: v.string(),
		agentId: v.id("agents"),
		message: v.string(),
		targetId: v.optional(v.id("tasks")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_target", ["tenantId", "targetId"]),

	documents: defineTable({
		title: v.string(),
		content: v.string(),
		type: v.string(),
		path: v.optional(v.string()),
		taskId: v.optional(v.id("tasks")),
		createdByAgentId: v.optional(v.id("agents")),
		messageId: v.optional(v.id("messages")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_task", ["tenantId", "taskId"]),

	notifications: defineTable({
		mentionedAgentId: v.id("agents"),
		content: v.string(),
		delivered: v.boolean(),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	}),

	usage: defineTable({
		taskId: v.optional(v.id("tasks")),
		projectId: v.optional(v.id("projects")),
		agentId: v.optional(v.string()),
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cacheReadTokens: v.optional(v.number()),
		cacheWriteTokens: v.optional(v.number()),
		cost: v.number(),
		runId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_task", ["tenantId", "taskId"])
		.index("by_tenant_project", ["tenantId", "projectId"]),

	apiTokens: defineTable({
		tokenHash: v.string(),
		tokenPrefix: v.string(),
		tenantId: v.optional(v.string()),
		orgId: v.optional(v.string()),
		name: v.optional(v.string()),
		createdAt: v.number(),
		lastUsedAt: v.optional(v.number()),
		revokedAt: v.optional(v.number()),
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_tenant", ["tenantId"]),

	tenantSettings: defineTable({
		tenantId: v.string(),
		retentionDays: v.number(),
		onboardingCompletedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	rateLimits: defineTable({
		tenantId: v.optional(v.string()),
		orgId: v.optional(v.string()),
		windowStartMs: v.number(),
		count: v.number(),
	}).index("by_tenant", ["tenantId"]),

	planUsageSnapshot: defineTable({
		tenantId: v.string(),
		planName: v.string(),
		sessionPct: v.number(),
		sessionResetAt: v.optional(v.string()),
		weeklyPct: v.number(),
		weeklyResetAt: v.optional(v.string()),
		fetchedAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	activityLog: defineTable({
		timestamp: v.number(),
		level: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("debug")),
		source: v.string(),
		action: v.string(),
		message: v.string(),
		metadata: v.optional(v.any()),
		taskId: v.optional(v.id("tasks")),
		agentId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_level", ["tenantId", "level"])
		.index("by_tenant_source", ["tenantId", "source"]),

	phaseState: defineTable({
		currentPhase: v.string(),
		model: v.optional(v.string()),
		lastSwap: v.number(),
		ramPercent: v.optional(v.number()),
		queuedCoding: v.optional(v.number()),
		queuedReasoning: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"]),

	phaseSwapHistory: defineTable({
		fromPhase: v.string(),
		toPhase: v.string(),
		timestamp: v.number(),
		trigger: v.optional(v.string()),
		codingQueuedAtSwap: v.optional(v.number()),
		reasoningQueuedAtSwap: v.optional(v.number()),
		durationMs: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"]),

	systemSettings: defineTable({
		key: v.string(),
		value: v.any(),
		updatedAt: v.number(),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_key", ["tenantId", "key"]),

	agentMetrics: defineTable({
		agentId: v.string(),
		date: v.string(),
		tasksCompleted: v.number(),
		tasksFailed: v.number(),
		tasksEscalated: v.number(),
		avgCompletionMs: v.optional(v.number()),
		tokensUsed: v.optional(v.number()),
		estimatedCost: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_agent", ["tenantId", "agentId"])
		.index("by_tenant_date", ["tenantId", "date"]),

	opusUsage: defineTable({
		date: v.string(),
		count: v.number(),
		log: v.array(v.object({
			taskId: v.id("tasks"),
			timestamp: v.number(),
			category: v.string(),
			summary: v.string(),
		})),
		tenantId: v.optional(v.string()),
	})
		.index("by_date", ["date"])
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_date", ["tenantId", "date"]),

	// Marketing ROI tracking
	marketingMetrics: defineTable({
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		month: v.string(), // YYYY-MM format
		channel: v.string(), // "LSA" | "Yelp" | "PPC" | "Organic" | "Direct" | etc
		spend: v.number(),
		leads: v.number(),
		conversions: v.number(),
		revenue: v.number(),
		cpl: v.number(), // cost per lead (calculated)
		conversionRate: v.number(), // conversion % (calculated)
		roi: v.number(), // return on investment (calculated)
		notes: v.optional(v.string()),
		tenantId: v.optional(v.string()),
		updatedAt: v.number(),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_location", ["tenantId", "location"])
		.index("by_tenant_month", ["tenantId", "month"])
		.index("by_tenant_location_month", ["tenantId", "location", "month"])
		.index("by_tenant_location_channel", ["tenantId", "location", "channel"]),

	// Risk signal detection (governance)
	riskSignals: defineTable({
		signalType: v.union(
			v.literal("repeated_failures"),
			v.literal("stale_task"),
			v.literal("autonomy_spike"),
			v.literal("budget_burn_spike"),
		),
		severity: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
			v.literal("critical"),
		),
		agentId: v.optional(v.string()),
		taskId: v.optional(v.id("tasks")),
		message: v.string(),
		metadata: v.optional(v.any()),
		resolvedAt: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_type", ["tenantId", "signalType"]),

	// Outbound webhook subscriptions
	webhooks: defineTable({
		url: v.string(),
		secret: v.string(),
		events: v.array(v.string()),
		enabled: v.boolean(),
		name: v.optional(v.string()),
		lastDeliveredAt: v.optional(v.number()),
		failCount: v.optional(v.number()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"]),

	leadAttribution: defineTable({
		leadId: v.string(), // SM order ID or custom identifier
		location: v.union(v.literal("phoenix"), v.literal("denver"), v.literal("chicago")),
		channel: v.string(),
		leadDate: v.string(), // YYYY-MM-DD
		customerName: v.string(),
		status: v.union(
			v.literal("new"),
			v.literal("contacted"),
			v.literal("quoted"),
			v.literal("booked"),
			v.literal("completed"),
			v.literal("lost"),
		),
		revenue: v.number(),
		smOrderId: v.optional(v.string()),
		notes: v.optional(v.string()),
		tenantId: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_location", ["tenantId", "location"])
		.index("by_tenant_channel", ["tenantId", "channel"])
		.index("by_tenant_leadId", ["tenantId", "leadId"])
		.index("by_tenant_status", ["tenantId", "status"]),
});
