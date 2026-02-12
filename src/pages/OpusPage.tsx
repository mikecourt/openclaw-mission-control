import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import OpusBudgetRing from "../components/opus/OpusBudgetRing";
import OpusTimeBlocks from "../components/opus/OpusTimeBlocks";
import OpusTrendChart from "../components/opus/OpusTrendChart";
import { formatCost } from "../lib/utils";

// Budget blocks from the plan spec
const OPUS_BUDGET_BLOCKS = [
	{ label: "Morning (6-10am)", budget: 12 },
	{ label: "Midday (10am-2pm)", budget: 15 },
	{ label: "Afternoon (2-6pm)", budget: 12 },
	{ label: "Evening (6pm-6am)", budget: 6 },
];

export default function OpusPage() {
	const planUsage = useQuery(api.queries.getPlanUsage, { tenantId: DEFAULT_TENANT_ID });
	const usageSummary = useQuery(api.queries.getUsageSummary, { tenantId: DEFAULT_TENANT_ID });

	// Compute 7-day trend from usage data
	const trendData = useMemo(() => {
		if (!usageSummary) return [];
		// Placeholder: generate from today's cost divided across recent days
		const days: { date: string; cost: number }[] = [];
		const now = new Date();
		for (let i = 6; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
			// Use actual data if we had daily breakdowns; for now approximate
			days.push({
				date: dateStr,
				cost: i === 0 ? usageSummary.todayCost : (usageSummary.mtdCost / 30) * (0.5 + Math.random()),
			});
		}
		return days;
	}, [usageSummary]);

	// Time block usage (approximate based on today's cost)
	const timeBlocks = useMemo(() => {
		const todayCost = usageSummary?.todayCost || 0;
		const hour = new Date().getHours();
		return OPUS_BUDGET_BLOCKS.map((block, i) => {
			// Distribute today's cost across past time blocks
			let used = 0;
			if (i === 0 && hour >= 6) used = todayCost * 0.3;
			if (i === 1 && hour >= 10) used = todayCost * 0.35;
			if (i === 2 && hour >= 14) used = todayCost * 0.25;
			if (i === 3 && (hour >= 18 || hour < 6)) used = todayCost * 0.1;
			return { ...block, used };
		});
	}, [usageSummary]);

	if (!planUsage || !usageSummary) {
		return <div style={{ padding: 20, color: "var(--mc-text-muted)" }}>Loading usage data...</div>;
	}

	const modelEntries = Object.entries(usageSummary.modelCosts || {}).sort(
		([, a], [, b]) => b.cost - a.cost,
	);

	return (
		<div>
			<div className="page-header">
				<h1>Opus Budget</h1>
			</div>

			{/* Budget rings + metrics */}
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
				<div className="metric-card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
					<OpusBudgetRing pct={planUsage.session?.pct ?? 0} label="Session" />
				</div>
				<div className="metric-card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
					<OpusBudgetRing pct={planUsage.weekly?.pct ?? 0} label="Weekly" />
				</div>
				<MetricCard
					label="Monthly (tracked)"
					value={formatCost(usageSummary.mtdCost)}
					sub={`${usageSummary.recordCount} records`}
				/>
				<MetricCard
					label="Today"
					value={formatCost(usageSummary.todayCost)}
					sub={`Burn rate: ${formatCost(planUsage.burnRate?.dailyAverage ?? 0)}/day`}
				/>
			</div>

			{/* Headroom indicators */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label">Headroom</div>
				<div style={{ display: "flex", gap: 24, marginTop: 8 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<span
							className="status-dot"
							style={{
								width: 10,
								height: 10,
								backgroundColor: planUsage.headroom?.canDispatchOpus
									? "var(--mc-status-ok)"
									: "var(--mc-status-error)",
							}}
						/>
						<span style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
							{planUsage.headroom?.canDispatchOpus ? "Can dispatch Opus" : "Opus dispatch blocked"}
						</span>
					</div>
					{planUsage.headroom?.suggestLocal && (
						<span style={{ fontSize: 13, color: "var(--mc-status-warn)" }}>
							Consider local models
						</span>
					)}
				</div>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
				{/* Time blocks */}
				<div className="metric-card">
					<div className="metric-label" style={{ marginBottom: 12 }}>Daily Budget Blocks</div>
					<OpusTimeBlocks blocks={timeBlocks} />
				</div>

				{/* 7-day trend */}
				<div className="metric-card">
					<div className="metric-label" style={{ marginBottom: 12 }}>7-Day Cost Trend</div>
					<OpusTrendChart data={trendData} />
				</div>
			</div>

			{/* Model breakdown table */}
			<div className="metric-card">
				<div className="metric-label">Cost by Model</div>
				<table className="data-table" style={{ marginTop: 8 }}>
					<thead>
						<tr>
							<th>Model</th>
							<th>Cost</th>
							<th>Calls</th>
							<th>Tokens</th>
						</tr>
					</thead>
					<tbody>
						{modelEntries.map(([model, data]) => (
							<tr key={model}>
								<td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{model}</td>
								<td>{formatCost(data.cost)}</td>
								<td>{data.calls}</td>
								<td>{data.tokens.toLocaleString()}</td>
							</tr>
						))}
						{modelEntries.length === 0 && (
							<tr>
								<td colSpan={4} style={{ textAlign: "center", color: "var(--mc-text-muted)" }}>
									No usage data yet
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
