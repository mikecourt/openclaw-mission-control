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
};

function AgentNodeComponent({ data }: NodeProps) {
	const d = data as unknown as AgentNodeData;
	const borderColor = d.category ? CATEGORY_COLORS[d.category] || "#6b7280" : "#6b7280";
	const disabled = d.isEnabled === false || d.status === "off";

	return (
		<div
			style={{
				background: "var(--mc-bg-card)",
				border: `2px solid ${borderColor}`,
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
			{d.tier && (
				<div style={{ marginTop: 6 }}>
					<TierBadge tier={d.tier} />
				</div>
			)}
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
