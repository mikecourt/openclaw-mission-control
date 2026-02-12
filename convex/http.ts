import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// --- Helpers ---

const JSON_HEADERS = { "Content-Type": "application/json" };

function validateBearer(request: Request): boolean {
	const token = process.env.MISSION_CONTROL_API_TOKEN;
	if (!token) return false;
	const auth = request.headers.get("Authorization");
	if (!auth) return false;
	return auth === `Bearer ${token}`;
}

function unauthorized() {
	return new Response(JSON.stringify({ error: "Unauthorized" }), {
		status: 401,
		headers: JSON_HEADERS,
	});
}

function badRequest(message: string) {
	return new Response(JSON.stringify({ error: message }), {
		status: 400,
		headers: JSON_HEADERS,
	});
}

function ok(data: unknown) {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: JSON_HEADERS,
	});
}

// OpenClaw webhook endpoint
http.route({
	path: "/openclaw/event",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.openclaw.receiveAgentEvent, body);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// --- Agent-facing HTTP API ---
// These endpoints let Aiden (and other agents) read from MC via curl

http.route({
	path: "/api/inbox",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const tasks = await ctx.runQuery(api.queries.getInboxTasks, { tenantId });
		return new Response(JSON.stringify(tasks), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/agent-tasks",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const agentName = url.searchParams.get("agent") || "";
		const tasks = await ctx.runQuery(api.queries.getAgentTasks, { tenantId, agentName });
		return new Response(JSON.stringify(tasks), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/blocked",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const tasks = await ctx.runQuery(api.queries.getBlockedTasks, { tenantId });
		return new Response(JSON.stringify(tasks), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/needs-input",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const tasks = await ctx.runQuery(api.queries.getNeedsInput, { tenantId });
		return new Response(JSON.stringify(tasks), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/overdue",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const tasks = await ctx.runQuery(api.queries.getOverdueTasks, { tenantId });
		return new Response(JSON.stringify(tasks), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/usage",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const summary = await ctx.runQuery(api.queries.getUsageSummary, { tenantId });
		return new Response(JSON.stringify(summary), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/api/plan-usage",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const planUsage = await ctx.runQuery(api.queries.getPlanUsage, { tenantId });
		return ok(planUsage);
	}),
});

// POST /api/plan-usage — receive real plan usage from cron script
http.route({
	path: "/api/plan-usage",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		const tenantId = body.tenantId || "default";
		await ctx.runMutation(api.planUsage.upsert, {
			tenantId,
			planName: body.planName || "Max",
			sessionPct: body.sessionPct ?? 0,
			sessionResetAt: body.sessionResetAt,
			weeklyPct: body.weeklyPct ?? 0,
			weeklyResetAt: body.weeklyResetAt,
			fetchedAt: body.fetchedAt || Date.now(),
		});
		return ok({ ok: true });
	}),
});

http.route({
	path: "/api/projects",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const projects = await ctx.runQuery(api.projects.listAll, { tenantId });
		return new Response(JSON.stringify(projects), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// --- Dispatch summary (for Aiden's dispatch loop) ---

http.route({
	path: "/api/dispatch-summary",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const summary = await ctx.runQuery(api.queries.getDispatchSummary, { tenantId });
		return ok(summary);
	}),
});

// --- Agent status management ---

http.route({
	path: "/api/agents/status",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			await ctx.runMutation(api.agents.updateStatusByName, {
				tenantId,
				agentName: body.agentName,
				status: body.status,
			});
			return ok({ ok: true });
		} catch (e: any) {
			return badRequest(e.message || "Failed to update agent status");
		}
	}),
});

// --- Agent next-work endpoint (read-only) ---

http.route({
	path: "/api/next-work",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const agentName = url.searchParams.get("agent") || "";
		if (!agentName) {
			return badRequest("Missing required query param: agent");
		}
		const result = await ctx.runQuery(api.queries.getNextWork, { tenantId, agentName });
		return ok(result);
	}),
});

// --- Agent write endpoints (bearer auth required) ---

// POST /api/tasks — create a task
http.route({
	path: "/api/tasks",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			const taskId = await ctx.runMutation(api.tasks.createTask, {
				title: body.title,
				description: body.description,
				status: body.status || "inbox",
				tags: body.tags || [],
				projectId: body.projectId,
				priority: body.priority,
				dueDate: body.dueDate,
				source: body.source || "agent",
				tenantId,
			});
			return ok({ ok: true, id: taskId });
		} catch (e: any) {
			return badRequest(e.message || "Failed to create task");
		}
	}),
});

// PUT /api/tasks/status — update task status
http.route({
	path: "/api/tasks/status",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			const agent = await ctx.runQuery(api.queries.getAgentByName, {
				tenantId,
				agentName: body.agentName,
			});
			if (!agent) return badRequest(`Agent "${body.agentName}" not found`);

			await ctx.runMutation(api.tasks.updateStatus, {
				taskId: body.taskId,
				status: body.status,
				agentId: agent._id,
				tenantId,
			});
			return ok({ ok: true });
		} catch (e: any) {
			return badRequest(e.message || "Failed to update status");
		}
	}),
});

// PUT /api/tasks/update — update task fields
http.route({
	path: "/api/tasks/update",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			const agent = await ctx.runQuery(api.queries.getAgentByName, {
				tenantId,
				agentName: body.agentName,
			});
			if (!agent) return badRequest(`Agent "${body.agentName}" not found`);

			await ctx.runMutation(api.tasks.updateTask, {
				taskId: body.taskId,
				tenantId,
				agentId: agent._id,
				title: body.title,
				description: body.description,
				tags: body.tags,
				projectId: body.projectId,
				priority: body.priority,
				dueDate: body.dueDate,
				blockedBy: body.blockedBy,
				needsInput: body.needsInput,
			});
			return ok({ ok: true });
		} catch (e: any) {
			return badRequest(e.message || "Failed to update task");
		}
	}),
});

// PUT /api/tasks/assignees — update task assignees
http.route({
	path: "/api/tasks/assignees",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";

			// Look up the acting agent
			const agent = await ctx.runQuery(api.queries.getAgentByName, {
				tenantId,
				agentName: body.agentName,
			});
			if (!agent) return badRequest(`Agent "${body.agentName}" not found`);

			// Look up all assignee agents by name
			const assigneeNames: string[] = body.assigneeNames || [];
			const assigneeIds: string[] = [];
			for (const name of assigneeNames) {
				const assignee = await ctx.runQuery(api.queries.getAgentByName, {
					tenantId,
					agentName: name,
				});
				if (!assignee) return badRequest(`Assignee "${name}" not found`);
				assigneeIds.push(assignee._id);
			}

			await ctx.runMutation(api.tasks.updateAssignees, {
				taskId: body.taskId,
				tenantId,
				assigneeIds: assigneeIds as any,
				agentId: agent._id,
			});
			return ok({ ok: true });
		} catch (e: any) {
			return badRequest(e.message || "Failed to update assignees");
		}
	}),
});

// POST /api/projects — create a project
http.route({
	path: "/api/projects",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			const projectId = await ctx.runMutation(api.projects.create, {
				name: body.name,
				description: body.description,
				status: body.status,
				area: body.area,
				milestones: body.milestones,
				borderColor: body.borderColor,
				tenantId,
			});
			return ok({ ok: true, id: projectId });
		} catch (e: any) {
			return badRequest(e.message || "Failed to create project");
		}
	}),
});

// PUT /api/projects/update — update a project
http.route({
	path: "/api/projects/update",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const tenantId = body.tenantId || "default";
			await ctx.runMutation(api.projects.update, {
				projectId: body.projectId,
				tenantId,
				name: body.name,
				description: body.description,
				status: body.status,
				area: body.area,
			});
			return ok({ ok: true });
		} catch (e: any) {
			return badRequest(e.message || "Failed to update project");
		}
	}),
});

// POST /api/phase/state — receive phase state from phase-swap.sh
http.route({
	path: "/api/phase/state",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		const tenantId = body.tenantId || "default";
		await ctx.runMutation(api.phase.updatePhaseState, {
			tenantId,
			currentPhase: body.currentPhase || "coding",
			model: body.model,
			ramPercent: body.ramPercent,
			queuedCoding: body.queuedCoding,
			queuedReasoning: body.queuedReasoning,
		});
		return ok({ ok: true });
	}),
});

// GET /api/phase/status — return current phase
http.route({
	path: "/api/phase/status",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const status = await ctx.runQuery(api.phase.getPhaseStatus, { tenantId });
		return ok(status);
	}),
});

// --- Orchestrator API ---

// POST /api/orchestrator/submit — classify + route + create task
http.route({
	path: "/api/orchestrator/submit",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const result = await ctx.runMutation(api.orchestrator.submitTask, {
				instruction: body.instruction,
				businessUnit: body.businessUnit || "cross",
				priority: body.priority,
				context: body.context,
				constraints: body.constraints,
				fromAgent: body.fromAgent,
				deadline: body.deadline,
				tenantId: body.tenantId || "default",
			});
			return ok(result);
		} catch (e: any) {
			return badRequest(e.message || "Failed to submit task");
		}
	}),
});

// POST /api/orchestrator/result — report task completion/failure
http.route({
	path: "/api/orchestrator/result",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		if (!validateBearer(request)) return unauthorized();
		try {
			const body = await request.json();
			const result = await ctx.runMutation(api.orchestrator.reportTaskResult, {
				taskId: body.taskId,
				status: body.status,
				result: body.result,
				failureReason: body.failureReason,
				optionsConsidered: body.optionsConsidered,
				tenantId: body.tenantId || "default",
			});
			return ok(result);
		} catch (e: any) {
			return badRequest(e.message || "Failed to report task result");
		}
	}),
});

// GET /api/orchestrator/dashboard — system overview
http.route({
	path: "/api/orchestrator/dashboard",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const dashboard = await ctx.runQuery(api.orchestrator.getSystemDashboard, { tenantId });
		return ok(dashboard);
	}),
});

// GET /api/orchestrator/opus — Opus budget status
http.route({
	path: "/api/orchestrator/opus",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const tenantId = url.searchParams.get("tenantId") || "default";
		const opus = await ctx.runQuery(api.orchestrator.getOpusDashboard, { tenantId });
		return ok(opus);
	}),
});

// POST /api/activity-log — external log ingestion
http.route({
	path: "/api/activity-log",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		const tenantId = body.tenantId || "default";
		await ctx.runMutation(api.activityLog.insert, {
			tenantId,
			timestamp: body.timestamp || Date.now(),
			level: body.level || "info",
			source: body.source || "external",
			action: body.action || "log",
			message: body.message || "",
			metadata: body.metadata,
			taskId: body.taskId,
			agentId: body.agentId,
		});
		return ok({ ok: true });
	}),
});

export default http;
