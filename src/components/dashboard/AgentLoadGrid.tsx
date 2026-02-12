import { useNavigate } from "react-router-dom";
import AgentAvatar from "../AgentAvatar";
import StatusDot from "../shared/StatusDot";

interface AgentLoadItem {
	id: string;
	name: string;
	avatar: string;
	status: string;
	activeTasks: number;
}

interface AgentLoadGridProps {
	agents: AgentLoadItem[];
}

const STATUS_BG: Record<string, string> = {
	active: "rgba(34,197,94,0.10)",
	idle: "rgba(107,114,128,0.10)",
	blocked: "rgba(234,179,8,0.10)",
	off: "rgba(239,68,68,0.08)",
};

export default function AgentLoadGrid({ agents }: AgentLoadGridProps) {
	const navigate = useNavigate();

	if (agents.length === 0) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: 220,
					color: "var(--mc-text-muted)",
					fontSize: 14,
				}}
			>
				No agents found
			</div>
		);
	}

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
				gap: 8,
				maxHeight: 220,
				overflowY: "auto",
			}}
		>
			{agents.map((agent) => (
				<button
					key={agent.id}
					type="button"
					onClick={() => navigate(`/agents/${agent.id}`)}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 4,
						padding: "10px 6px",
						borderRadius: 8,
						border: "1px solid var(--mc-border, #333)",
						background: STATUS_BG[agent.status] || "transparent",
						cursor: "pointer",
						transition: "background 0.15s",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "rgba(255,255,255,0.06)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background =
							STATUS_BG[agent.status] || "transparent";
					}}
				>
					<AgentAvatar name={agent.name} avatar={agent.avatar} size={28} />
					<span
						style={{
							fontSize: 11,
							color: "var(--mc-text-primary)",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							maxWidth: "100%",
						}}
					>
						{agent.name}
					</span>
					<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
						<StatusDot status={agent.status} size={6} />
						<span
							style={{
								fontSize: 10,
								color: "var(--mc-text-muted)",
							}}
						>
							{agent.activeTasks} task{agent.activeTasks !== 1 ? "s" : ""}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}
