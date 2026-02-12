import { formatRelativeTime } from "../../lib/utils";

interface ActivityEntry {
	type?: string;
	level?: string;
	agentName?: string;
	agentId?: string;
	source?: string;
	message: string;
	_creationTime: number;
	timestamp?: number;
}

interface RecentActivityMiniProps {
	activities: ActivityEntry[];
}

const TYPE_COLORS: Record<string, string> = {
	info: "#3b82f6",
	warn: "#eab308",
	error: "#ef4444",
	debug: "#6b7280",
	status_update: "#22c55e",
	task_update: "#3b82f6",
	message: "#8b5cf6",
	decision: "#f59e0b",
	document_created: "#06b6d4",
};

export default function RecentActivityMini({ activities }: RecentActivityMiniProps) {
	const items = activities.slice(0, 10);

	if (items.length === 0) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: 160,
					color: "var(--mc-text-muted)",
					fontSize: 14,
				}}
			>
				No recent activity
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
			{items.map((entry, i) => {
				const dotColor =
					TYPE_COLORS[entry.level || entry.type || ""] || "#6b7280";
				const label = entry.agentName || entry.source || entry.agentId || "system";
				const ts = entry.timestamp || entry._creationTime;
				const message =
					entry.message.length > 120
						? entry.message.slice(0, 117) + "..."
						: entry.message;

				return (
					<div
						key={`${ts}-${i}`}
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 8,
							padding: "5px 0",
							borderBottom:
								i < items.length - 1
									? "1px solid var(--mc-border, #333)"
									: undefined,
						}}
					>
						<span
							style={{
								width: 7,
								height: 7,
								borderRadius: "50%",
								backgroundColor: dotColor,
								flexShrink: 0,
								marginTop: 5,
							}}
						/>
						<span
							style={{
								fontSize: 11,
								color: "var(--mc-text-secondary)",
								width: 64,
								flexShrink: 0,
								fontWeight: 600,
							}}
						>
							{label}
						</span>
						<span
							style={{
								fontSize: 11,
								color: "var(--mc-text-primary)",
								flex: 1,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{message}
						</span>
						<span
							style={{
								fontSize: 10,
								color: "var(--mc-text-muted)",
								flexShrink: 0,
								whiteSpace: "nowrap",
							}}
						>
							{formatRelativeTime(ts)}
						</span>
					</div>
				);
			})}
		</div>
	);
}
