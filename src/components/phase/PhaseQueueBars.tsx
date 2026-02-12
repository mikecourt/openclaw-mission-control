interface PhaseQueueBarsProps {
	codingQueued: number;
	reasoningQueued: number;
}

export default function PhaseQueueBars({ codingQueued, reasoningQueued }: PhaseQueueBarsProps) {
	const maxQueue = Math.max(codingQueued, reasoningQueued, 1);

	const bars = [
		{ label: "Coding", count: codingQueued, color: "#3b82f6" },
		{ label: "Reasoning", count: reasoningQueued, color: "#8b5cf6" },
	];

	return (
		<div style={{ display: "grid", gap: 10 }}>
			{bars.map((bar) => (
				<div key={bar.label}>
					<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
						<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>{bar.label}</span>
						<span style={{ fontSize: 12, fontWeight: 600, color: bar.color }}>{bar.count}</span>
					</div>
					<div
						style={{
							height: 10,
							backgroundColor: "var(--mc-border)",
							borderRadius: 5,
							overflow: "hidden",
						}}
					>
						<div
							style={{
								height: "100%",
								width: `${(bar.count / maxQueue) * 100}%`,
								backgroundColor: bar.color,
								borderRadius: 5,
								transition: "width 0.3s ease",
								minWidth: bar.count > 0 ? 4 : 0,
							}}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
