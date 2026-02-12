interface RAMGaugeProps {
	ramPercent: number | null | undefined;
}

export default function RAMGauge({ ramPercent }: RAMGaugeProps) {
	if (ramPercent == null) {
		return (
			<div style={{ color: "var(--mc-text-muted)", fontSize: 13 }}>
				RAM data not available
			</div>
		);
	}

	const systemPct = Math.min(ramPercent, 100);
	const modelPct = Math.max(0, Math.min(100 - systemPct, 40)); // estimate model at 40% or remaining
	const freePct = Math.max(0, 100 - systemPct - modelPct);

	const segments = [
		{ label: "System", pct: systemPct, color: "#3b82f6" },
		{ label: "Model", pct: modelPct, color: "#8b5cf6" },
		{ label: "Free", pct: freePct, color: "#22c55e" },
	];

	return (
		<div>
			{/* Bar */}
			<div
				style={{
					height: 20,
					borderRadius: 10,
					overflow: "hidden",
					display: "flex",
					backgroundColor: "var(--mc-border)",
				}}
			>
				{segments.map((seg) =>
					seg.pct > 0 ? (
						<div
							key={seg.label}
							style={{
								width: `${seg.pct}%`,
								backgroundColor: seg.color,
								transition: "width 0.3s ease",
							}}
						/>
					) : null,
				)}
			</div>

			{/* Legend */}
			<div style={{ display: "flex", gap: 16, marginTop: 8 }}>
				{segments.map((seg) => (
					<div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
						<div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: seg.color }} />
						<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>
							{seg.label} ({seg.pct}%)
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
