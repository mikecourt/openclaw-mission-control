import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import TaskFlowChart from "../components/dashboard/TaskFlowChart";
import AgentLoadGrid from "../components/dashboard/AgentLoadGrid";
import BusinessSplitCard from "../components/dashboard/BusinessSplitCard";
import RecentActivityMini from "../components/dashboard/RecentActivityMini";

export default function DashboardPage() {
	const overview = useQuery(api.dashboard.getSystemOverview, { tenantId: DEFAULT_TENANT_ID });
	const planUsage = useQuery(api.queries.getPlanUsage, { tenantId: DEFAULT_TENANT_ID });
	const throughput = useQuery(api.dashboard.getTaskThroughput, { tenantId: DEFAULT_TENANT_ID });
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const businessSplit = useQuery(api.dashboard.getBusinessSplit, { tenantId: DEFAULT_TENANT_ID });
	const recentLog = useQuery(api.activityLog.getRecentLog, { tenantId: DEFAULT_TENANT_ID, limit: 10 });
	const allTasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });

	// Transform throughput data for the chart
	const chartData = useMemo(() => {
		if (!throughput) return [];
		return throughput.map((bucket) => ({
			time: bucket.hour.slice(11) + ":00", // extract "HH" and add ":00"
			completed: bucket.count,
			failed: 0, // throughput query only returns completed counts
		}));
	}, [throughput]);

	// Build agent load grid data
	const agentLoadData = useMemo(() => {
		if (!agents) return [];
		return agents.map((agent) => {
			const activeTasks = allTasks
				? allTasks.filter(
						(t) =>
							t.assigneeIds.includes(agent._id) &&
							(t.status === "in_progress" || t.status === "assigned"),
					).length
				: 0;
			return {
				id: agent._id,
				name: agent.name,
				avatar: agent.avatar,
				status: agent.status,
				activeTasks,
			};
		});
	}, [agents, allTasks]);

	// Transform business split data into Record<string, number>
	const businessSplitMap = useMemo(() => {
		if (!businessSplit) return {};
		const result: Record<string, number> = {};
		for (const item of businessSplit) {
			result[item.name] = item.count;
		}
		return result;
	}, [businessSplit]);

	if (!overview) {
		return <div style={{ padding: 20, color: "var(--mc-text-muted)" }}>Loading dashboard...</div>;
	}

	return (
		<div>
			<div className="page-header">
				<h1>Dashboard</h1>
			</div>

			{/* Metric cards row */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
				<MetricCard
					label="Active Agents"
					value={overview.agents.active}
					sub={`${overview.agents.idle} idle / ${overview.agents.total} total`}
					color="var(--mc-status-ok)"
				/>
				<MetricCard
					label="Active Tasks"
					value={overview.tasks.active}
					sub={`${overview.tasks.queued} queued`}
				/>
				<MetricCard
					label="Completed Today"
					value={overview.tasks.completedToday}
					sub={`${overview.tasks.failedToday} failed`}
					color="var(--mc-status-active)"
				/>
				<MetricCard
					label="Needs Review"
					value={overview.tasks.review}
					color={overview.tasks.review > 0 ? "var(--mc-status-warn)" : undefined}
				/>
				{planUsage && (
					<MetricCard
						label="Session Usage"
						value={`${planUsage.session?.pct ?? 0}%`}
						sub={`Weekly: ${planUsage.weekly?.pct ?? 0}%`}
						color={
							(planUsage.session?.pct ?? 0) > 80
								? "var(--mc-status-error)"
								: (planUsage.session?.pct ?? 0) > 60
									? "var(--mc-status-warn)"
									: "var(--mc-status-ok)"
						}
					/>
				)}
			</div>

			{/* Row 1: Task Throughput (2 cols) + Agent Load (1 col) */}
			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
				<div className="metric-card" style={{ minHeight: 300 }}>
					<div className="metric-label">Task Throughput (24h)</div>
					<TaskFlowChart data={chartData} />
				</div>
				<div className="metric-card" style={{ minHeight: 300 }}>
					<div className="metric-label">Agent Load</div>
					<AgentLoadGrid agents={agentLoadData} />
				</div>
			</div>

			{/* Row 2: Business Split (1 col) + Recent Activity (2 cols) */}
			<div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
				<div className="metric-card">
					<div className="metric-label">Business Split</div>
					<BusinessSplitCard data={businessSplitMap} />
				</div>
				<div className="metric-card">
					<div className="metric-label">Recent Activity</div>
					<RecentActivityMini activities={recentLog ?? []} />
				</div>
			</div>
		</div>
	);
}
