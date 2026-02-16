import { formatRelativeTime } from "../../lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface RiskSignal {
	_id: Id<"riskSignals">;
	signalType: string;
	severity: string;
	agentId?: string;
	taskId?: Id<"tasks">;
	message: string;
	_creationTime: number;
}

interface RiskSignalCardsProps {
	signals: RiskSignal[];
	onResolve: (signalId: Id<"riskSignals">) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
	critical: "#ef4444",
	high: "#f97316",
	medium: "#eab308",
	low: "#3b82f6",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
	repeated_failures: "Repeated Failures",
	stale_task: "Stale Task",
	autonomy_spike: "Autonomy Spike",
	budget_burn_spike: "Budget Burn",
};

export default function RiskSignalCards({ signals, onResolve }: RiskSignalCardsProps) {
	if (signals.length === 0) return null;

	const hasCriticalOrHigh = signals.some(
		(s) => s.severity === "critical" || s.severity === "high",
	);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<span
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: "var(--mc-text-primary)",
					}}
				>
					Risk Signals
				</span>
				<span
					style={{
						fontSize: 11,
						fontWeight: 600,
						padding: "1px 7px",
						borderRadius: 9,
						background: hasCriticalOrHigh
							? "rgba(239,68,68,0.18)"
							: "rgba(107,114,128,0.18)",
						color: hasCriticalOrHigh ? "#ef4444" : "var(--mc-text-muted)",
					}}
				>
					{signals.length}
				</span>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
				{signals.map((signal) => {
					const borderColor = SEVERITY_COLORS[signal.severity] || "#6b7280";
					const typeLabel =
						SIGNAL_TYPE_LABELS[signal.signalType] || signal.signalType;

					return (
						<div
							key={signal._id}
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 6,
								padding: "10px 12px",
								borderRadius: 8,
								borderLeft: `3px solid ${borderColor}`,
								background: "var(--mc-bg-secondary)",
								border: `1px solid var(--mc-border, #333)`,
								borderLeftColor: borderColor,
								borderLeftWidth: 3,
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									justifyContent: "space-between",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<span
										style={{
											fontSize: 12,
											fontWeight: 600,
											color: "var(--mc-text-primary)",
										}}
									>
										{typeLabel}
									</span>
									<span
										style={{
											fontSize: 10,
											fontWeight: 600,
											padding: "1px 6px",
											borderRadius: 6,
											background: `${borderColor}22`,
											color: borderColor,
											textTransform: "capitalize",
										}}
									>
										{signal.severity}
									</span>
									{signal.agentId && (
										<span
											style={{
												fontSize: 11,
												color: "var(--mc-text-muted)",
											}}
										>
											{signal.agentId}
										</span>
									)}
								</div>
								<span
									style={{
										fontSize: 10,
										color: "var(--mc-text-muted)",
										flexShrink: 0,
										whiteSpace: "nowrap",
									}}
								>
									{formatRelativeTime(signal._creationTime)}
								</span>
							</div>

							<div
								style={{
									display: "flex",
									alignItems: "flex-start",
									justifyContent: "space-between",
									gap: 12,
								}}
							>
								<span
									style={{
										fontSize: 12,
										color: "var(--mc-text-primary)",
										lineHeight: 1.4,
									}}
								>
									{signal.message}
								</span>
								<button
									type="button"
									onClick={() => onResolve(signal._id)}
									style={{
										fontSize: 11,
										padding: "2px 8px",
										borderRadius: 4,
										border: "1px solid var(--mc-border, #333)",
										background: "transparent",
										color: "var(--mc-text-muted)",
										cursor: "pointer",
										flexShrink: 0,
										whiteSpace: "nowrap",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = "rgba(255,255,255,0.06)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									Dismiss
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
