import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { IconTool, IconCheck, IconLoader2 } from "@tabler/icons-react";

type TroubleshootState = "idle" | "running" | "complete" | "timed_out";

const TASK_DESCRIPTION = `## Gateway Health Check & Repair

1. Run \`openclaw doctor\` and capture output
2. Check if gateway port 18789 is responding
3. If gateway is unhealthy, restart it with \`openclaw gateway restart\`
4. Verify gateway is back online after restart
5. Report findings back to Control Tower`;

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const COMPLETE_DISPLAY_MS = 5000;
const TIMED_OUT_DISPLAY_MS = 3000;

const GatewayTroubleshooter: React.FC = () => {
	const [state, setState] = useState<TroubleshootState>("idle");
	const [taskId, setTaskId] = useState<Id<"tasks"> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const createTask = useMutation(api.tasks.createTask);
	const updateAssignees = useMutation(api.tasks.updateAssignees);

	const forgeAgent = agents?.find((a) => a.name === "Forge");

	// Watch task status for completion
	const trackedTask = taskId && tasks ? tasks.find((t) => t._id === taskId) : null;

	useEffect(() => {
		if (state !== "running" || !trackedTask) return;
		if (trackedTask.status === "done" || trackedTask.status === "review") {
			setState("complete");
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		}
	}, [state, trackedTask]);

	// Auto-return to idle after complete/timed_out
	useEffect(() => {
		if (state === "complete" || state === "timed_out") {
			const delay = state === "complete" ? COMPLETE_DISPLAY_MS : TIMED_OUT_DISPLAY_MS;
			completeTimerRef.current = setTimeout(() => {
				setState("idle");
				setTaskId(null);
			}, delay);
			return () => {
				if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
			};
		}
	}, [state]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
		};
	}, []);

	const handleClick = useCallback(async () => {
		if (state !== "idle") return;

		try {
			const newTaskId = await createTask({
				title: "[TROUBLESHOOT] Gateway health check & repair",
				description: TASK_DESCRIPTION,
				status: "inbox",
				tags: ["maintenance", "gateway", "auto-detected"],
				priority: "urgent",
				source: "agent",
				tenantId: DEFAULT_TENANT_ID,
			});

			if (forgeAgent) {
				await updateAssignees({
					taskId: newTaskId,
					assigneeIds: [forgeAgent._id as Id<"agents">],
					agentId: forgeAgent._id as Id<"agents">,
					tenantId: DEFAULT_TENANT_ID,
				});
			}

			setTaskId(newTaskId);
			setState("running");

			// 10-minute timeout
			timeoutRef.current = setTimeout(() => {
				setState("timed_out");
			}, TIMEOUT_MS);
		} catch (err) {
			console.error("Failed to create troubleshoot task:", err);
		}
	}, [state, createTask, updateAssignees, forgeAgent]);

	const label =
		state === "running"
			? "DIAGNOSING..."
			: state === "complete"
				? "COMPLETE"
				: state === "timed_out"
					? "TIMED OUT"
					: "GATEWAY";

	const colorClass =
		state === "running"
			? "bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]"
			: state === "complete"
				? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
				: state === "timed_out"
					? "bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
					: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground";

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={state !== "idle"}
			className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-[0.5px] transition-colors ${colorClass} ${state !== "idle" ? "cursor-not-allowed" : "cursor-pointer"}`}
		>
			{state === "running" ? (
				<IconLoader2 size={14} className="animate-spin" />
			) : state === "complete" ? (
				<IconCheck size={14} />
			) : (
				<IconTool size={14} />
			)}
			{label}
		</button>
	);
};

export default GatewayTroubleshooter;
