import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import DataTable from "../components/shared/DataTable";
import PriorityBadge from "../components/shared/PriorityBadge";
import BusinessUnitBadge from "../components/shared/BusinessUnitBadge";
import TimeAgo from "../components/shared/TimeAgo";
import MetricCard from "../components/shared/MetricCard";
import TaskFilters from "../components/tasks/TaskFilters";
import TaskSubmitModal from "../components/tasks/TaskSubmitModal";
import { TASK_STATUS_COLORS } from "../lib/constants";
import { formatDuration } from "../lib/utils";
import { IconPlus, IconFilter } from "@tabler/icons-react";

export default function TasksPage() {
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const navigate = useNavigate();

	const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
	const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined);
	const [businessUnitFilter, setBusinessUnitFilter] = useState<string | undefined>(undefined);
	const [search, setSearch] = useState("");
	const [showFilters, setShowFilters] = useState(true);
	const [showModal, setShowModal] = useState(false);

	const agentMap = new Map((agents || []).map((a) => [a._id, a]));

	// Compute status counts from all tasks (before filtering)
	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const t of tasks || []) {
			if (t.status === "archived") continue;
			counts[t.status] = (counts[t.status] || 0) + 1;
		}
		return counts;
	}, [tasks]);

	// Compute stats
	const stats = useMemo(() => {
		const all = tasks || [];
		const now = Date.now();
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		return {
			active: all.filter((t) => t.status === "in_progress").length,
			queued: all.filter((t) => t.status === "inbox" || t.status === "assigned").length,
			completedToday: all.filter((t) => t.status === "done" && t._creationTime >= todayMs).length,
			review: all.filter((t) => t.status === "review").length,
		};
	}, [tasks]);

	// Apply filters
	const taskList = useMemo(() => {
		let filtered = (tasks || []).filter((t) => t.status !== "archived");

		if (statusFilter) {
			filtered = filtered.filter((t) => t.status === statusFilter);
		}
		if (priorityFilter) {
			filtered = filtered.filter((t) => t.priority === priorityFilter);
		}
		if (businessUnitFilter) {
			filtered = filtered.filter((t) => t.businessUnit === businessUnitFilter);
		}
		if (search.trim()) {
			const q = search.toLowerCase();
			filtered = filtered.filter(
				(t) =>
					t.title.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q),
			);
		}

		return filtered.sort((a, b) => b._creationTime - a._creationTime);
	}, [tasks, statusFilter, priorityFilter, businessUnitFilter, search]);

	const columns = [
		{
			key: "status",
			label: "Status",
			width: "100px",
			render: (row: (typeof taskList)[0]) => (
				<span
					className="badge"
					style={{
						backgroundColor: `${TASK_STATUS_COLORS[row.status] || "#6b7280"}20`,
						color: TASK_STATUS_COLORS[row.status] || "#6b7280",
					}}
				>
					{row.status.replace("_", " ")}
				</span>
			),
		},
		{
			key: "priority",
			label: "Priority",
			width: "90px",
			render: (row: (typeof taskList)[0]) =>
				row.priority ? <PriorityBadge priority={row.priority} /> : <span style={{ color: "var(--mc-text-muted)" }}>-</span>,
		},
		{ key: "title", label: "Task" },
		{
			key: "businessUnit",
			label: "Business",
			width: "100px",
			render: (row: (typeof taskList)[0]) =>
				row.businessUnit ? (
					<BusinessUnitBadge unit={row.businessUnit} />
				) : (
					<span style={{ color: "var(--mc-text-muted)", fontSize: 12 }}>-</span>
				),
		},
		{
			key: "assignees",
			label: "Assignees",
			width: "140px",
			render: (row: (typeof taskList)[0]) => {
				const names = row.assigneeIds
					.map((id: string) => agentMap.get(id)?.name)
					.filter(Boolean);
				return names.length > 0 ? (
					<span style={{ fontSize: 12 }}>{names.join(", ")}</span>
				) : (
					<span style={{ color: "var(--mc-text-muted)", fontSize: 12 }}>Unassigned</span>
				);
			},
		},
		{
			key: "source",
			label: "Source",
			width: "80px",
			render: (row: (typeof taskList)[0]) => (
				<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>{row.source || "-"}</span>
			),
		},
		{
			key: "duration",
			label: "Duration",
			width: "90px",
			render: (row: (typeof taskList)[0]) => {
				if (!row.startedAt) return <span style={{ color: "var(--mc-text-muted)", fontSize: 12 }}>-</span>;
				const end = row.completedAt || (row.status === "done" ? row._creationTime : Date.now());
				return (
					<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>
						{formatDuration(end - row.startedAt)}
					</span>
				);
			},
		},
		{
			key: "_creationTime",
			label: "Created",
			width: "100px",
			render: (row: (typeof taskList)[0]) => (
				<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>
					<TimeAgo timestamp={row._creationTime} />
				</span>
			),
		},
	];

	return (
		<div>
			<div className="page-header">
				<h1>Tasks</h1>
				<div className="actions" style={{ display: "flex", gap: 8 }}>
					<button
						type="button"
						className={showFilters ? "btn-primary" : "btn-secondary"}
						onClick={() => setShowFilters(!showFilters)}
						style={{ display: "flex", alignItems: "center", gap: 4 }}
					>
						<IconFilter size={16} /> Filters
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={() => setShowModal(true)}
					>
						<IconPlus size={16} /> New Task
					</button>
				</div>
			</div>

			{/* Stats row */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
				<MetricCard label="Active" value={stats.active} color="var(--mc-status-ok)" />
				<MetricCard label="Queued" value={stats.queued} />
				<MetricCard label="Completed Today" value={stats.completedToday} color="var(--mc-status-active)" />
				<MetricCard label="Needs Review" value={stats.review} color={stats.review > 0 ? "var(--mc-status-warn)" : undefined} />
			</div>

			<div style={{ display: "grid", gridTemplateColumns: showFilters ? "260px 1fr" : "1fr", gap: 16 }}>
				{/* Filter sidebar */}
				{showFilters && (
					<div className="metric-card" style={{ alignSelf: "start" }}>
						<TaskFilters
							statusFilter={statusFilter}
							onStatusChange={setStatusFilter}
							priorityFilter={priorityFilter}
							onPriorityChange={setPriorityFilter}
							businessUnitFilter={businessUnitFilter}
							onBusinessUnitChange={setBusinessUnitFilter}
							search={search}
							onSearchChange={setSearch}
							statusCounts={statusCounts}
						/>
					</div>
				)}

				{/* Task table */}
				<div className="metric-card" style={{ padding: 0 }}>
					<div style={{ padding: "10px 16px", borderBottom: "1px solid var(--mc-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>
							{taskList.length} task{taskList.length !== 1 ? "s" : ""}
							{(statusFilter || priorityFilter || businessUnitFilter || search) && " (filtered)"}
						</span>
					</div>
					<DataTable
						columns={columns}
						data={taskList}
						getRowKey={(row) => row._id}
						onRowClick={(row) => navigate(`/tasks/${row._id}`)}
						emptyMessage="No tasks match the current filters"
					/>
				</div>
			</div>

			<TaskSubmitModal open={showModal} onClose={() => setShowModal(false)} />
		</div>
	);
}
