import { useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import TaskFlowChart from "../components/dashboard/TaskFlowChart";
import AgentLoadGrid from "../components/dashboard/AgentLoadGrid";
import BusinessSplitCard from "../components/dashboard/BusinessSplitCard";
import RecentActivityMini from "../components/dashboard/RecentActivityMini";
import ModelUsageTable from "../components/dashboard/ModelUsageTable";
import CostChart from "../components/dashboard/CostChart";
import RiskSignalCards from "../components/dashboard/RiskSignalCards";

export default function DashboardPage() {
	const overview = useQuery(api.dashboard.getSystemOverview, { tenantId: DEFAULT_TENANT_ID });
	const planUsage = useQuery(api.queries.getPlanUsage, { tenantId: DEFAULT_TENANT_ID });
	const throughput = useQuery(api.dashboard.getTaskThroughput, { tenantId: DEFAULT_TENANT_ID });
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const businessSplit = useQuery(api.dashboard.getBusinessSplit, { tenantId: DEFAULT_TENANT_ID });
	const recentLog = useQuery(api.activityLog.getRecentLog, { tenantId: DEFAULT_TENANT_ID, limit: 10 });
	const allTasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const modelUsage = useQuery(api.dashboard.getUsageByModel, { tenantId: DEFAULT_TENANT_ID });
	const costOverTime = useQuery(api.dashboard.getCostOverTime, { tenantId: DEFAULT_TENANT_ID, hours: 24 });
	const orchestration = useQuery(api.escalation.getOrchestrationMetrics, { tenantId: DEFAULT_TENANT_ID });
	const activeSignals = useQuery(api.riskSignals.getActiveSignals, { tenantId: DEFAULT_TENANT_ID });
	const resolveSignal = useMutation(api.riskSignals.resolveSignal);

	const handleResolveSignal = useCallback(
		(signalId: Parameters<typeof resolveSignal>[0]["signalId"]) => {
			resolveSignal({ tenantId: DEFAULT_TENANT_ID, signalId });
		},
		[resolveSignal],
	);

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

	// Format reset time helper
	const formatResetTime = (ms: number) => {
		if (ms <= 0) return "";
		const hours = Math.floor(ms / (60 * 60 * 1000));
		const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
		if (hours >= 24) return `${Math.floor(hours / 24)}d`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

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
						sub={`resets ${formatResetTime(planUsage.session?.resetMs ?? 0)} • Weekly: ${planUsage.weekly?.pct ?? 0}% (resets ${formatResetTime(planUsage.weekly?.resetMs ?? 0)})`}
						color={
							(planUsage.session?.pct ?? 0) > 80
								? "var(--mc-status-error)"
								: (planUsage.session?.pct ?? 0) > 60
									? "var(--mc-status-warn)"
									: "var(--mc-status-ok)"
						}
					/>
				)}
				<MetricCard
					label="Risk Signals"
					value={overview.riskSignals?.total ?? 0}
					color={
						(overview.riskSignals?.critical ?? 0) > 0 || (overview.riskSignals?.high ?? 0) > 0
							? "#ef4444"
							: (overview.riskSignals?.medium ?? 0) > 0
								? "#f97316"
								: "var(--mc-status-ok)"
					}
				/>
			</div>

			{/* Risk signals cards */}
			{activeSignals && activeSignals.length > 0 && (
				<div style={{ marginBottom: 24 }}>
					<div className="metric-card">
						<RiskSignalCards signals={activeSignals} onResolve={handleResolveSignal} />
					</div>
				</div>
			)}

			{/* Orchestration metrics row */}
			{orchestration && (orchestration.qaGates > 0 || orchestration.retries > 0 || orchestration.escalations > 0 || orchestration.dispatches > 0) && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
					<MetricCard
						label="QA Gates Today"
						value={orchestration.qaGates}
						sub={orchestration.passRate !== null ? `${orchestration.passRate}% pass rate` : undefined}
					/>
					<MetricCard
						label="Retries"
						value={orchestration.retries}
						color={orchestration.retries > 0 ? "#f97316" : undefined}
					/>
					<MetricCard
						label="Escalations"
						value={orchestration.escalations}
						sub={orchestration.escalatedTasks > 0 ? `${orchestration.escalatedTasks} tasks escalated` : undefined}
						color={orchestration.escalations > 0 ? "#ef4444" : undefined}
					/>
					<MetricCard
						label="Pass Rate"
						value={orchestration.passRate !== null ? `${orchestration.passRate}%` : "N/A"}
						color={
							orchestration.passRate === null
								? undefined
								: orchestration.passRate >= 80
									? "var(--mc-status-ok)"
									: orchestration.passRate >= 50
										? "var(--mc-status-warn)"
										: "var(--mc-status-error)"
						}
					/>
				</div>
			)}

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
			<div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
				<div className="metric-card">
					<div className="metric-label">Business Split</div>
					<BusinessSplitCard data={businessSplitMap} />
				</div>
				<div className="metric-card">
					<div className="metric-label">Recent Activity</div>
					<RecentActivityMini activities={recentLog ?? []} />
				</div>
			</div>

			{/* Row 3: Usage Analytics */}
			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
				<div className="metric-card" style={{ minHeight: 250 }}>
					<div className="metric-label">Cost Over Time (24h)</div>
					<CostChart data={costOverTime ?? []} />
				</div>
				<div className="metric-card" style={{ minHeight: 250 }}>
					<div className="metric-label">Usage by Model</div>
					<ModelUsageTable data={modelUsage ?? []} />
				</div>
			</div>
		</div>
	);
}
