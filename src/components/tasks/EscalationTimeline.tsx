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
	qa_gate: "#3b82f6",
	retry: "#f97316",
	escalate: "#ef4444",
	handoff: "#8b5cf6",
	dispatch: "#06b6d4",
	blocked: "#eab308",
};

const EVENT_LABELS: Record<string, string> = {
	qa_gate: "QA Gate",
	retry: "Retry",
	escalate: "Escalated",
	handoff: "Handoff",
	dispatch: "Dispatch",
	blocked: "Blocked",
	completed: "Completed",
	review: "Review",
	failed: "Failed",
	escalated: "Escalated",
	in_progress: "In Progress",
};

function statusToDotKind(status: string): "active" | "off" | "blocked" | "idle" {
	if (status === "completed" || status === "qa_gate" || status === "dispatch") return "active";
	if (status === "failed" || status === "escalate") return "off";
	return "blocked";
}

function parseTransfer(reason?: string): { fromAgent?: string; toAgent?: string; rest?: string } | null {
	if (!reason) return null;
	const arrowMatch = reason.match(/^(?:.*?\|)?\s*(\S+)\s*→\s*(\S+)(?:\s*\|(.*))?$/);
	if (arrowMatch) {
		return {
			fromAgent: arrowMatch[1],
			toAgent: arrowMatch[2],
			rest: arrowMatch[3]?.trim() || undefined,
		};
	}
	const toMatch = reason.match(/^(?:.*?\|)?\s*→\s*(\S+)(?:\s*\|(.*))?$/);
	if (toMatch) {
		return {
			toAgent: toMatch[1],
			rest: toMatch[2]?.trim() || undefined,
		};
	}
	return null;
}

function parseFeedback(reason?: string): string | null {
	if (!reason) return null;
	const match = reason.match(/feedback:\s*(.+)/);
	return match ? match[1].trim() : null;
}

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

			{history.map((entry, i) => {
				const transfer = parseTransfer(entry.reason);
				const feedback = parseFeedback(entry.reason);
				const color = STATUS_COLORS[entry.status] || "#6b7280";
				const label = EVENT_LABELS[entry.status] || entry.status;

				return (
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
								status={statusToDotKind(entry.status)}
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
										backgroundColor: `${color}20`,
										color,
										fontSize: 10,
									}}
								>
									{label}
								</span>
							</div>
							<div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--mc-text-muted)" }}>
								<span>{formatRelativeTime(entry.timestamp)}</span>
								{entry.duration != null && <span>{formatDuration(entry.duration)}</span>}
								{entry.model && (
									<span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{entry.model}</span>
								)}
							</div>

							{/* Transfer display (from → to) */}
							{transfer && (transfer.fromAgent || transfer.toAgent) && (
								<div style={{ fontSize: 12, color: "var(--mc-text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
									{transfer.fromAgent && (
										<span style={{ fontWeight: 500 }}>{transfer.fromAgent}</span>
									)}
									{transfer.fromAgent && transfer.toAgent && (
										<span style={{ color: "var(--mc-text-muted)" }}>→</span>
									)}
									{transfer.toAgent && (
										<span style={{ fontWeight: 500 }}>{transfer.toAgent}</span>
									)}
									{transfer.rest && (
										<span style={{ color: "var(--mc-text-muted)", marginLeft: 4 }}>— {transfer.rest}</span>
									)}
								</div>
							)}

							{/* Reason (when no transfer parsed, or non-transfer reason) */}
							{entry.reason && !transfer && (
								<div style={{ fontSize: 12, color: "var(--mc-text-secondary)", marginTop: 4 }}>
									{entry.reason}
								</div>
							)}

							{/* Feedback block for retry events */}
							{feedback && (
								<div
									style={{
										fontSize: 11,
										color: "var(--mc-text-muted)",
										marginTop: 4,
										paddingLeft: 12,
										borderLeft: `2px solid ${STATUS_COLORS.retry || "#f97316"}40`,
										fontStyle: "italic",
									}}
								>
									{feedback}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
