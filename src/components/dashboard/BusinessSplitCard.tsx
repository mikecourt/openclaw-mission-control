import { BUSINESS_UNIT_COLORS } from "../../lib/constants";

interface BusinessSplitCardProps {
	data: Record<string, number>;
}

export default function BusinessSplitCard({ data }: BusinessSplitCardProps) {
	const entries = Object.entries(data);

	if (entries.length === 0) {
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
				No tasks by business unit
			</div>
		);
	}

	const maxCount = Math.max(...entries.map(([_, count]) => count), 1);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
			{entries.map(([unit, count]) => {
				const color = BUSINESS_UNIT_COLORS[unit] || BUSINESS_UNIT_COLORS.unassigned;
				const widthPct = (count / maxCount) * 100;
				return (
					<div key={unit} style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<span
							style={{
								width: 80,
								flexShrink: 0,
								fontSize: 12,
								color: "var(--mc-text-secondary)",
								textTransform: "capitalize",
								textAlign: "right",
							}}
						>
							{unit}
						</span>
						<div
							style={{
								flex: 1,
								height: 20,
								background: "rgba(255,255,255,0.04)",
								borderRadius: 4,
								overflow: "hidden",
								position: "relative",
							}}
						>
							<div
								style={{
									width: `${widthPct}%`,
									height: "100%",
									background: color,
									borderRadius: 4,
									transition: "width 0.3s ease",
									minWidth: count > 0 ? 4 : 0,
								}}
							/>
						</div>
						<span
							style={{
								width: 28,
								flexShrink: 0,
								fontSize: 12,
								color: "var(--mc-text-primary)",
								fontWeight: 600,
								textAlign: "right",
							}}
						>
							{count}
						</span>
					</div>
				);
			})}
		</div>
	);
}
