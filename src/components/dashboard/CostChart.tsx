import { useMemo } from "react";

interface CostChartProps {
	data: Array<{ hour: string; cost: number; tokens: number }>;
}

export default function CostChart({ data }: CostChartProps) {
	const maxCost = useMemo(() => Math.max(...data.map((d) => d.cost), 0.01), [data]);

	if (!data || data.length === 0) {
		return (
			<div style={{ padding: 40, textAlign: "center", color: "var(--mc-text-muted)", fontSize: 13 }}>
				No cost data yet
			</div>
		);
	}

	return (
		<div style={{ position: "relative", height: 200, paddingTop: 10 }}>
			{/* Y-axis labels */}
			<div style={{ position: "absolute", left: 0, top: 10, bottom: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10, color: "var(--mc-text-muted)" }}>
				<div>${maxCost.toFixed(2)}</div>
				<div>${(maxCost / 2).toFixed(2)}</div>
				<div>$0</div>
			</div>

			{/* Chart area */}
			<div style={{ marginLeft: 50, height: "100%", display: "flex", alignItems: "flex-end", gap: 2, paddingBottom: 20 }}>
				{data.map((bucket, i) => {
					const height = maxCost > 0 ? (bucket.cost / maxCost) * 100 : 0;
					const time = bucket.hour.slice(11); // Extract "HH"
					return (
						<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
							<div
								style={{
									width: "100%",
									height: `${height}%`,
									backgroundColor: bucket.cost > 0 ? "var(--mc-accent-blue)" : "var(--mc-bg-tertiary)",
									borderRadius: "2px 2px 0 0",
									minHeight: bucket.cost > 0 ? 2 : 0,
								}}
								title={`${time}:00 - $${bucket.cost.toFixed(3)} (${(bucket.tokens / 1000).toFixed(1)}K tokens)`}
							/>
							{i % 3 === 0 && (
								<div style={{ fontSize: 9, color: "var(--mc-text-muted)", marginTop: 4 }}>
									{time}:00
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
