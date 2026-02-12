import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface OpusBudgetRingProps {
	pct: number;
	label: string;
	color?: string;
}

export default function OpusBudgetRing({ pct, label, color }: OpusBudgetRingProps) {
	const fillColor = color || (pct > 80 ? "#ef4444" : pct > 60 ? "#eab308" : "#22c55e");

	const data = [{ name: label, value: Math.min(pct, 100), fill: fillColor }];

	return (
		<div style={{ textAlign: "center" }}>
			<div style={{ width: 140, height: 140, margin: "0 auto", position: "relative" }}>
				<ResponsiveContainer width="100%" height="100%">
					<RadialBarChart
						cx="50%"
						cy="50%"
						innerRadius="70%"
						outerRadius="100%"
						barSize={12}
						data={data}
						startAngle={90}
						endAngle={-270}
					>
						<PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
						<RadialBar
							background={{ fill: "#2a2a3a" }}
							dataKey="value"
							angleAxisId={0}
							cornerRadius={6}
						/>
					</RadialBarChart>
				</ResponsiveContainer>
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						textAlign: "center",
					}}
				>
					<div style={{ fontSize: 22, fontWeight: 700, color: fillColor }}>{pct}%</div>
				</div>
			</div>
			<div style={{ fontSize: 12, color: "var(--mc-text-muted)", marginTop: 4 }}>{label}</div>
		</div>
	);
}
