import React from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import AgentAvatar from "./AgentAvatar";
import ModelBadge from "./shared/ModelBadge";
import BusinessUnitBadge from "./shared/BusinessUnitBadge";
import { STATUS_LABELS } from "../lib/constants";
import type { EffectiveStatus } from "../lib/status";

interface AgentCardProps {
	agent: {
		_id: string;
		name: string;
		role: string;
		avatar?: string;
		status: string;
		model?: string;
		businessUnit?: string;
	};
	effectiveStatus: EffectiveStatus;
	utilization?: {
		activeCount: number;
		completedCount: number;
		totalCost: number;
	};
	onAddTask?: (agentId: string) => void;
	onDelete?: (agentId: string) => void;
	onSelectAgent?: (agentId: string) => void;
	compact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
	agent,
	effectiveStatus,
	utilization,
	onAddTask,
	onDelete,
	onSelectAgent,
	compact = false,
}) => {
	const updateStatus = useMutation(api.agents.updateStatus);
	const navigate = useNavigate();

	const hasStats = utilization && (utilization.activeCount > 0 || utilization.completedCount > 0 || utilization.totalCost > 0);

	return (
		<div
			className="relative flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted transition-colors group bg-card border border-border rounded-lg"
			onClick={() => onSelectAgent?.(agent._id)}
		>
			{onDelete && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						if (confirm(`Delete ${agent.name}?`)) {
							onDelete(agent._id);
						}
					}}
					className="absolute left-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-[22px] w-[22px] items-center justify-center rounded hover:bg-[var(--accent-red)]/10 text-[var(--accent-red)] z-10"
					aria-label={`Delete ${agent.name}`}
					title={`Delete ${agent.name}`}
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
						<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
					</svg>
				</button>
			)}
			<AgentAvatar name={agent.name} avatar={agent.avatar} size={compact ? 40 : 50} />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 mb-0.5">
					<span className="text-sm font-semibold text-foreground">
						{agent.name}
					</span>
				</div>
				<div className="text-xs text-muted-foreground mb-1">{agent.role}</div>

				{/* Model and Business Unit badges */}
				<div className="flex items-center gap-1.5 mb-1 flex-wrap">
					{agent.model && <ModelBadge model={agent.model} />}
					{agent.businessUnit && <BusinessUnitBadge unit={agent.businessUnit} />}
				</div>

				{hasStats && (
					<div className="flex items-center gap-2 mt-1">
						{utilization!.activeCount > 0 && (
							<span className="text-[9px] font-semibold px-1 py-0.5 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] rounded">
								{utilization!.activeCount} active
							</span>
						)}
						{utilization!.completedCount > 0 && (
							<span className="text-[9px] font-semibold px-1 py-0.5 bg-[var(--accent-green)]/15 text-[var(--accent-green)] rounded">
								{utilization!.completedCount} done
							</span>
						)}
						{utilization!.totalCost > 0 && (
							<span className="text-[9px] font-mono text-muted-foreground">
								${utilization!.totalCost.toFixed(2)}
							</span>
						)}
					</div>
				)}
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						const cycle: Record<string, "idle" | "active" | "blocked" | "off"> = {
							active: "idle",
							idle: "off",
							off: "active",
							blocked: "active",
						};
						updateStatus({
							id: agent._id,
							status: cycle[agent.status] ?? "active",
							tenantId: DEFAULT_TENANT_ID,
						});
					}}
					className={`text-[9px] font-bold flex items-center gap-1 tracking-wider uppercase cursor-pointer hover:opacity-70 transition-opacity ${
						effectiveStatus === "active"
							? "text-[var(--status-working)]"
							: effectiveStatus === "blocked"
								? "text-[var(--accent-orange)]"
								: effectiveStatus === "off"
									? "text-[var(--status-off)]"
									: "text-muted-foreground"
					}`}
					title={`Status: ${STATUS_LABELS[effectiveStatus] || effectiveStatus} — click to cycle`}
				>
					<span
						className={`w-1.5 h-1.5 rounded-full ${
							effectiveStatus === "active"
								? "bg-[var(--status-working)]"
								: effectiveStatus === "blocked"
									? "bg-[var(--accent-orange)]"
									: effectiveStatus === "off"
										? "bg-[var(--status-off)]"
										: "bg-muted-foreground"
						}`}
					/>
					{STATUS_LABELS[effectiveStatus] || effectiveStatus}
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						navigate(`/tasks?new=true&assignee=${agent._id}`);
					}}
					disabled={effectiveStatus === "off"}
					className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-white text-base font-bold leading-none transition-opacity ${
						effectiveStatus === "off"
							? "bg-muted-foreground/40 cursor-not-allowed"
							: "bg-[var(--accent-blue)] hover:opacity-90"
					}`}
					aria-label={`Add task for ${agent.name}`}
					title={effectiveStatus === "off" ? `${agent.name} is disabled` : `Add task for ${agent.name}`}
				>
					+
				</button>
			</div>
		</div>
	);
};

export default AgentCard;
