import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import AgentAvatar from "../AgentAvatar";
import StatusDot from "../shared/StatusDot";
import TierBadge from "../shared/TierBadge";
import { CATEGORY_COLORS } from "../../lib/constants";

export type AgentNodeData = {
	label: string;
	name: string;
	role: string;
	avatar: string;
	status: string;
	tier?: string;
	category?: string;
	isEnabled?: boolean;
	agentId: string;
	agentRole?: string;   // "manager" | "ic"
	directReports?: number;
};

function AgentNodeComponent({ data }: NodeProps) {
	const d = data as unknown as AgentNodeData;
	const borderColor = d.category ? CATEGORY_COLORS[d.category] || "#6b7280" : "#6b7280";
	const disabled = d.isEnabled === false || d.status === "off";
	const isManager = d.agentRole === "manager";

	return (
		<div
			style={{
				background: "var(--mc-bg-card)",
				border: `${isManager ? 3 : 2}px solid ${borderColor}`,
				borderRadius: 10,
				padding: "10px 14px",
				minWidth: 160,
				opacity: disabled ? 0.5 : 1,
				cursor: "pointer",
			}}
		>
			<Handle
				type="target"
				position={Position.Top}
				style={{
					width: 8,
					height: 8,
					background: "var(--mc-bg-card)",
					border: "2px solid var(--mc-border)",
				}}
			/>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<AgentAvatar name={d.name} avatar={d.avatar} size={28} />
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span
							style={{
								fontWeight: 500,
								fontSize: 13,
								color: "var(--mc-text-primary)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{d.name}
						</span>
						<StatusDot status={d.status} size={6} />
					</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--mc-text-muted)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{d.role}
					</div>
				</div>
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
				{d.tier && <TierBadge tier={d.tier} />}
				{d.agentRole && (
					<span
						style={{
							fontSize: 10,
							padding: "1px 6px",
							borderRadius: 4,
							background: isManager ? "rgba(245, 158, 11, 0.15)" : "rgba(107, 114, 128, 0.15)",
							color: isManager ? "#f59e0b" : "var(--mc-text-muted)",
							fontWeight: 500,
						}}
					>
						{isManager ? "MGR" : "IC"}
					</span>
				)}
				{isManager && d.directReports !== undefined && d.directReports > 0 && (
					<span
						style={{
							fontSize: 10,
							padding: "1px 6px",
							borderRadius: 4,
							background: "rgba(99, 102, 241, 0.15)",
							color: "#6366f1",
						}}
					>
						{d.directReports} report{d.directReports !== 1 ? "s" : ""}
					</span>
				)}
			</div>
			<Handle
				type="source"
				position={Position.Bottom}
				style={{
					width: 8,
					height: 8,
					background: "var(--mc-bg-card)",
					border: "2px solid var(--mc-border)",
				}}
			/>
		</div>
	);
}

export default memo(AgentNodeComponent);
