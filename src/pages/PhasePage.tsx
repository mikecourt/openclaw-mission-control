import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import RAMGauge from "../components/phase/RAMGauge";
import PhaseQueueBars from "../components/phase/PhaseQueueBars";
import { PHASE_COLORS } from "../lib/constants";
import { formatDuration, formatRelativeTime } from "../lib/utils";

export default function PhasePage() {
	const phaseStatus = useQuery(api.phase.getPhaseStatus, { tenantId: DEFAULT_TENANT_ID });
	const swapHistory = useQuery(api.phase.getSwapHistory, { tenantId: DEFAULT_TENANT_ID, limit: 20 });

	if (!phaseStatus) {
		return <div style={{ padding: 20, color: "var(--mc-text-muted)" }}>Loading phase data...</div>;
	}

	const phaseColor = PHASE_COLORS[phaseStatus.currentPhase] || "#6b7280";

	return (
		<div>
			<div className="page-header">
				<h1>Phase Manager</h1>
			</div>

			{/* Current phase metrics */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
				<MetricCard
					label="Current Phase"
					value={phaseStatus.currentPhase}
					color={phaseColor}
				/>
				<MetricCard
					label="Loaded Model"
					value={phaseStatus.model || "None"}
					sub={phaseStatus.lastSwap ? `Last swap: ${formatRelativeTime(phaseStatus.lastSwap)}` : undefined}
				/>
				<MetricCard
					label="RAM Usage"
					value={phaseStatus.ramPercent != null ? `${phaseStatus.ramPercent}%` : "N/A"}
					color={
						phaseStatus.ramPercent != null
							? phaseStatus.ramPercent > 85
								? "var(--mc-status-error)"
								: phaseStatus.ramPercent > 70
									? "var(--mc-status-warn)"
									: "var(--mc-status-ok)"
							: undefined
					}
				/>
				<MetricCard
					label="Total Swaps"
					value={swapHistory?.length ?? 0}
				/>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
				{/* RAM Gauge */}
				<div className="metric-card">
					<div className="metric-label" style={{ marginBottom: 12 }}>RAM Distribution</div>
					<RAMGauge ramPercent={phaseStatus.ramPercent} />
				</div>

				{/* Queue depth */}
				<div className="metric-card">
					<div className="metric-label" style={{ marginBottom: 12 }}>Queue Depth</div>
					<PhaseQueueBars
						codingQueued={phaseStatus.queuedCoding ?? 0}
						reasoningQueued={phaseStatus.queuedReasoning ?? 0}
					/>
				</div>
			</div>

			{/* Phase toggle */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label">Phase Control</div>
				<div style={{ display: "flex", gap: 12, marginTop: 12 }}>
					<button
						className={phaseStatus.currentPhase === "coding" ? "btn-primary" : "btn-secondary"}
						style={phaseStatus.currentPhase === "coding" ? { backgroundColor: PHASE_COLORS.coding } : {}}
						type="button"
					>
						Coding Phase
					</button>
					<button
						className={phaseStatus.currentPhase === "reasoning" ? "btn-primary" : "btn-secondary"}
						style={phaseStatus.currentPhase === "reasoning" ? { backgroundColor: PHASE_COLORS.reasoning } : {}}
						type="button"
					>
						Reasoning Phase
					</button>
				</div>
				<p style={{ fontSize: 12, color: "var(--mc-text-muted)", marginTop: 8 }}>
					Phase swapping is managed by the phase-swap.sh script. Manual swap is not yet enabled.
				</p>
			</div>

			{/* Swap history */}
			<div className="metric-card">
				<div className="metric-label">Swap History</div>
				{(swapHistory || []).length === 0 ? (
					<div style={{ color: "var(--mc-text-muted)", fontSize: 13, marginTop: 8 }}>No swap events recorded</div>
				) : (
					<table className="data-table" style={{ marginTop: 8 }}>
						<thead>
							<tr>
								<th>From</th>
								<th>To</th>
								<th>Trigger</th>
								<th>Coding Queue</th>
								<th>Reasoning Queue</th>
								<th>Duration</th>
								<th>When</th>
							</tr>
						</thead>
						<tbody>
							{(swapHistory || []).map((swap) => (
								<tr key={swap._id}>
									<td>
										<span style={{ color: PHASE_COLORS[swap.fromPhase] }}>{swap.fromPhase}</span>
									</td>
									<td>
										<span style={{ color: PHASE_COLORS[swap.toPhase] }}>{swap.toPhase}</span>
									</td>
									<td style={{ fontSize: 12 }}>{swap.trigger || "-"}</td>
									<td style={{ fontSize: 12 }}>{swap.codingQueuedAtSwap ?? "-"}</td>
									<td style={{ fontSize: 12 }}>{swap.reasoningQueuedAtSwap ?? "-"}</td>
									<td style={{ fontSize: 12 }}>{swap.durationMs ? formatDuration(swap.durationMs) : "-"}</td>
									<td style={{ fontSize: 12 }}>{formatRelativeTime(swap.timestamp)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
