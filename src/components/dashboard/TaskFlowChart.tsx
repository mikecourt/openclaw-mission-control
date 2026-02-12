import {
	ResponsiveContainer,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
} from "recharts";

interface TaskFlowDataPoint {
	time: string;
	completed: number;
	failed: number;
}

interface TaskFlowChartProps {
	data: TaskFlowDataPoint[];
}

export default function TaskFlowChart({ data }: TaskFlowChartProps) {
	if (data.length === 0) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: 220,
					color: "var(--mc-text-muted)",
					fontSize: 14,
				}}
			>
				No data yet
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={220}>
			<AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
				<defs>
					<linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
						<stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
					</linearGradient>
					<linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
						<stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
				<XAxis
					dataKey="time"
					tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
					axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
					tickLine={false}
				/>
				<YAxis
					tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
					axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
					tickLine={false}
					allowDecimals={false}
				/>
				<Tooltip
					contentStyle={{
						backgroundColor: "var(--mc-bg-card, #1e1e2e)",
						border: "1px solid var(--mc-border, #333)",
						borderRadius: 6,
						color: "var(--mc-text-primary, #fff)",
						fontSize: 12,
					}}
				/>
				<Area
					type="monotone"
					dataKey="completed"
					stroke="#22c55e"
					fillOpacity={1}
					fill="url(#colorCompleted)"
					strokeWidth={2}
				/>
				<Area
					type="monotone"
					dataKey="failed"
					stroke="#ef4444"
					fillOpacity={1}
					fill="url(#colorFailed)"
					strokeWidth={2}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}
