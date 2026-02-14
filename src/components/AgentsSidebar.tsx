import React, { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import AgentAvatar from "./AgentAvatar";
import { STATUS_LABELS } from "../lib/constants";
import { getEffectiveStatus, type EffectiveStatus } from "../lib/status";

type AgentsSidebarProps = {
	isOpen?: boolean;
	onClose?: () => void;
	onAddTask?: (preselectedAgentId?: string) => void;
	onSelectAgent?: (agentId: string) => void;
};

const AgentsSidebar: React.FC<AgentsSidebarProps> = ({
	isOpen = false,
	onClose,
	onAddTask,
	onSelectAgent,
}) => {
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const utilization = useQuery(api.queries.getAgentUtilization, { tenantId: DEFAULT_TENANT_ID });
	const updateStatus = useMutation(api.agents.updateStatus);

	const getUtilization = (agentId: string) =>
		utilization?.find((u) => u.agentId === agentId);

	const effectiveStatusMap = useMemo(() => {
		if (!agents) return new Map<string, EffectiveStatus>();
		const map = new Map<string, EffectiveStatus>();
		for (const a of agents) {
			map.set(a._id, getEffectiveStatus(a, tasks || []));
		}
		return map;
	}, [agents, tasks]);

	if (agents === undefined) {
		return (
			<aside
				className={`[grid-area:left-sidebar] sidebar-drawer sidebar-drawer--left bg-card border-r border-border flex flex-col overflow-hidden animate-pulse ${isOpen ? "is-open" : ""}`}
				aria-label="Agents"
			>
				<div className="px-6 py-5 border-b border-border h-[65px] bg-muted/20" />
				<div className="flex-1 space-y-4 p-6">
					{[...Array(8)].map((_, i) => (
						<div key={i} className="flex gap-3 items-center">
							<div className="w-[50px] h-[50px] bg-muted rounded-full" />
							<div className="flex-1 space-y-2">
								<div className="h-3 bg-muted rounded w-24" />
								<div className="h-2 bg-muted rounded w-16" />
							</div>
						</div>
					))}
				</div>
			</aside>
		);
	}

	return (
		<aside
			className={`[grid-area:left-sidebar] sidebar-drawer sidebar-drawer--left bg-card border-r border-border flex flex-col overflow-hidden ${isOpen ? "is-open" : ""}`}
			aria-label="Agents"
		>
			<div className="flex items-center justify-between px-6 py-5 border-b border-border">
				<div className="text-[11px] font-bold tracking-widest text-muted-foreground flex items-center gap-2">
					<span className="w-1.5 h-1.5 bg-[var(--accent-green)] rounded-full" />{" "}
					AGENTS
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
						onClick={onClose}
						aria-label="Close agents sidebar"
					>
						<span aria-hidden="true">✕</span>
					</button>
					<div className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-semibold">
						{agents.length}
					</div>
				</div>
			</div>

			{onAddTask && (
				<div className="px-6 py-3 border-b border-border">
					<button
						type="button"
						onClick={() => onAddTask?.()}
						className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[var(--accent-blue)] rounded-lg hover:opacity-90 transition-opacity"
					>
						<span className="text-base leading-none">+</span> Add Task
					</button>
				</div>
			)}

			<div className="flex-1 overflow-y-auto py-3">
				{agents.map((agent) => {
					const es = effectiveStatusMap.get(agent._id) ?? agent.status;
					return (
					<div
						key={agent._id}
						className="relative flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted transition-colors group"
						onClick={() => onSelectAgent?.(agent._id)}
					>
						<AgentAvatar name={agent.name} avatar={agent.avatar} size={50} />
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-1.5 mb-0.5">
								<span className="text-sm font-semibold text-foreground">
									{agent.name}
								</span>
							</div>
							<div className="text-xs text-muted-foreground">{agent.role}</div>
							{(() => {
								const util = getUtilization(agent._id);
								if (!util) return null;
								const hasStats = util.activeCount > 0 || util.completedCount > 0 || util.totalCost > 0;
								if (!hasStats) return null;
								return (
									<div className="flex items-center gap-2 mt-1">
										{util.activeCount > 0 && (
											<span className="text-[9px] font-semibold px-1 py-0.5 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] rounded">
												{util.activeCount} active
											</span>
										)}
										{util.completedCount > 0 && (
											<span className="text-[9px] font-semibold px-1 py-0.5 bg-[var(--accent-green)]/15 text-[var(--accent-green)] rounded">
												{util.completedCount} done
											</span>
										)}
										{util.totalCost > 0 && (
											<span className="text-[9px] font-mono text-muted-foreground">
												${util.totalCost.toFixed(2)}
											</span>
										)}
									</div>
								);
							})()}
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
									es === "active"
										? "text-[var(--status-working)]"
										: es === "blocked"
											? "text-[var(--accent-orange)]"
											: es === "off"
												? "text-[var(--status-off)]"
												: "text-muted-foreground"
								}`}
								title={`Status: ${STATUS_LABELS[es] || es} — click to cycle`}
							>
								<span
									className={`w-1.5 h-1.5 rounded-full ${
										es === "active"
											? "bg-[var(--status-working)]"
											: es === "blocked"
												? "bg-[var(--accent-orange)]"
												: es === "off"
													? "bg-[var(--status-off)]"
													: "bg-muted-foreground"
									}`}
								/>
								{STATUS_LABELS[es] || es}
							</button>
							{onAddTask && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onAddTask(agent._id);
									}}
									disabled={es !== "active"}
									className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-white text-base font-bold leading-none transition-opacity ${
										es !== "active"
											? "bg-muted-foreground/40 cursor-not-allowed"
											: "bg-[var(--accent-blue)] hover:opacity-90"
									}`}
									aria-label={`Add task for ${agent.name}`}
									title={es !== "active" ? `${agent.name} is idle` : `Add task for ${agent.name}`}
								>
									+
								</button>
							)}
						</div>
					</div>
					);
				})}
			</div>
		</aside>
	);
};

export default AgentsSidebar;
