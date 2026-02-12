interface MetricCardProps {
	label: string;
	value: string | number;
	sub?: string;
	color?: string;
}

export default function MetricCard({ label, value, sub, color }: MetricCardProps) {
	return (
		<div className="metric-card">
			<div className="metric-label">{label}</div>
			<div className="metric-value" style={color ? { color } : undefined}>
				{value}
			</div>
			{sub && <div className="metric-sub">{sub}</div>}
		</div>
	);
}
