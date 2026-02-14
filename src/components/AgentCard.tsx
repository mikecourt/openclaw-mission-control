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
	onSelectAgent?: (agentId: string) => void;
	compact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
	agent,
	effectiveStatus,
	utilization,
	onAddTask: _onAddTask,
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
							id: agent._id as any,
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
