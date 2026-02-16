import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DayData {
	date: string;
	cost: number;
}

interface OpusTrendChartProps {
	data: DayData[];
}

export default function OpusTrendChart({ data }: OpusTrendChartProps) {
	if (data.length === 0) {
		return (
			<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mc-text-muted)", fontSize: 13 }}>
				No trend data available
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
				<XAxis
					dataKey="date"
					tick={{ fill: "#8888a0", fontSize: 11 }}
					axisLine={{ stroke: "#2a2a3a" }}
					tickLine={false}
				/>
				<YAxis
					tick={{ fill: "#8888a0", fontSize: 11 }}
					axisLine={{ stroke: "#2a2a3a" }}
					tickLine={false}
					tickFormatter={(v) => `$${v}`}
				/>
				<Tooltip
					contentStyle={{
						background: "#1a1a26",
						border: "1px solid #2a2a3a",
						borderRadius: 6,
						fontSize: 12,
					}}
					labelStyle={{ color: "#e4e4ef" }}
					formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Cost"]}
				/>
				<Line
					type="monotone"
					dataKey="cost"
					stroke="#6366f1"
					strokeWidth={2}
					dot={{ fill: "#6366f1", r: 3 }}
					activeDot={{ r: 5 }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
