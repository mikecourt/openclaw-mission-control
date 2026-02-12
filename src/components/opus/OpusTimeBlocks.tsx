interface TimeBlock {
	label: string;
	budget: number;
	used: number;
}

interface OpusTimeBlocksProps {
	blocks: TimeBlock[];
}

export default function OpusTimeBlocks({ blocks }: OpusTimeBlocksProps) {
	return (
		<div style={{ display: "grid", gap: 12 }}>
			{blocks.map((block) => {
				const pct = block.budget > 0 ? Math.min((block.used / block.budget) * 100, 100) : 0;
				const color = pct > 80 ? "#ef4444" : pct > 60 ? "#eab308" : "#22c55e";

				return (
					<div key={block.label}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
							<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>{block.label}</span>
							<span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>
								${block.used.toFixed(2)} / ${block.budget.toFixed(2)}
							</span>
						</div>
						<div
							style={{
								height: 8,
								backgroundColor: "var(--mc-border)",
								borderRadius: 4,
								overflow: "hidden",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${pct}%`,
									backgroundColor: color,
									borderRadius: 4,
									transition: "width 0.3s ease",
								}}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
