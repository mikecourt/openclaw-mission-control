import React from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { STATUS_LABELS } from "../lib/constants";
import AgentAvatar from "./AgentAvatar";

type AgentDetailTrayProps = {
	agentId: Id<"agents"> | null;
	onClose: () => void;
};

const AgentDetailTray: React.FC<AgentDetailTrayProps> = ({ agentId, onClose }) => {
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const agent = agents?.find((a) => a._id === agentId) ?? null;
	const isOpen = agentId !== null;

	return (
		<div className={`agent-tray ${isOpen ? "is-open" : ""}`}>
			{agent && (
				<div className="flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center justify-between px-5 py-4 border-b border-border">
						<h2 className="text-sm font-bold tracking-wide text-foreground">
							Agent Details
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
							aria-label="Close tray"
						>
							✕
						</button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
						{/* Avatar + Name header */}
						<div className="flex items-center gap-4">
							<AgentAvatar name={agent.name} avatar={agent.avatar} size={56} />
							<div className="flex-1">
								<div className="text-lg font-bold text-foreground">{agent.name}</div>
								<div className="text-xs text-muted-foreground">{agent.role}</div>
							</div>
						</div>

						{/* Level + Status row */}
						<div className="flex items-center gap-3">
							<span
								className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
									agent.level === "LEAD"
										? "bg-[var(--status-lead)]"
										: agent.level === "INT"
											? "bg-[var(--status-int)]"
											: "bg-[var(--status-spc)]"
								}`}
							>
								{agent.level}
							</span>

							<div
								className={`text-[10px] font-bold flex items-center gap-1 tracking-wider uppercase ${
									agent.status === "active"
										? "text-[var(--status-working)]"
										: agent.status === "blocked"
											? "text-[var(--accent-orange)]"
											: agent.status === "off"
												? "text-[var(--status-off)]"
												: "text-muted-foreground"
								}`}
							>
								<span
									className={`w-1.5 h-1.5 rounded-full ${
										agent.status === "active"
											? "bg-[var(--status-working)]"
											: agent.status === "blocked"
												? "bg-[var(--accent-orange)]"
												: agent.status === "off"
													? "bg-[var(--status-off)]"
													: "bg-muted-foreground"
									}`}
								/>
								{STATUS_LABELS[agent.status] || agent.status}
							</div>
						</div>

						{/* Model */}
						{agent.model && (
							<div>
								<div className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-1">MODEL</div>
								<div className="text-sm text-foreground font-mono bg-muted/50 rounded-lg px-3 py-2">
									{agent.model}
								</div>
							</div>
						)}
					</div>

					{/* Footer — View Details link */}
					<div className="px-5 py-4 border-t border-border">
						<Link
							to={`/agents/${agent._id}`}
							onClick={onClose}
							className="block w-full px-4 py-2 text-sm font-semibold text-white bg-[var(--accent-blue)] rounded-lg hover:opacity-90 transition-opacity text-center"
						>
							View Details
						</Link>
					</div>
				</div>
			)}
		</div>
	);
};

export default AgentDetailTray;
