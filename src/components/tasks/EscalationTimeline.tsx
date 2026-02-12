import { formatDuration, formatRelativeTime } from "../../lib/utils";
import StatusDot from "../shared/StatusDot";

interface EscalationEntry {
	agentId: string;
	model?: string;
	timestamp: number;
	duration?: number;
	status: string;
	reason?: string;
}

interface EscalationTimelineProps {
	history: EscalationEntry[];
}

const STATUS_COLORS: Record<string, string> = {
	completed: "#22c55e",
	review: "#eab308",
	failed: "#ef4444",
	escalated: "#f97316",
	in_progress: "#3b82f6",
};

export default function EscalationTimeline({ history }: EscalationTimelineProps) {
	if (history.length === 0) {
		return (
			<div style={{ color: "var(--mc-text-muted)", fontSize: 13, padding: "8px 0" }}>
				No escalation events
			</div>
		);
	}

	return (
		<div style={{ position: "relative", paddingLeft: 20 }}>
			{/* Vertical line */}
			<div
				style={{
					position: "absolute",
					left: 6,
					top: 4,
					bottom: 4,
					width: 2,
					backgroundColor: "var(--mc-border)",
				}}
			/>

			{history.map((entry, i) => (
				<div
					key={`${entry.agentId}-${entry.timestamp}`}
					style={{
						position: "relative",
						paddingBottom: i < history.length - 1 ? 16 : 0,
					}}
				>
					{/* Dot on timeline */}
					<div
						style={{
							position: "absolute",
							left: -17,
							top: 3,
						}}
					>
						<StatusDot
							status={entry.status === "completed" ? "active" : entry.status === "failed" ? "off" : "blocked"}
							size={10}
						/>
					</div>

					{/* Content */}
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
							<span style={{ fontSize: 13, fontWeight: 600, color: "var(--mc-text-primary)" }}>
								{entry.agentId}
							</span>
							<span
								className="badge"
								style={{
									backgroundColor: `${STATUS_COLORS[entry.status] || "#6b7280"}20`,
									color: STATUS_COLORS[entry.status] || "#6b7280",
									fontSize: 10,
								}}
							>
								{entry.status}
							</span>
						</div>
						<div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--mc-text-muted)" }}>
							<span>{formatRelativeTime(entry.timestamp)}</span>
							{entry.duration != null && <span>{formatDuration(entry.duration)}</span>}
							{entry.model && (
								<span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{entry.model}</span>
							)}
						</div>
						{entry.reason && (
							<div style={{ fontSize: 12, color: "var(--mc-text-secondary)", marginTop: 4 }}>
								{entry.reason}
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
