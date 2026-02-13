import { TASK_STATUS_COLORS, PRIORITY_COLORS, BUSINESS_UNIT_COLORS } from "../../lib/constants";

interface TaskFiltersProps {
	statusFilter: string | undefined;
	onStatusChange: (status: string | undefined) => void;
	priorityFilter: string | undefined;
	onPriorityChange: (priority: string | undefined) => void;
	businessUnitFilter: string | undefined;
	onBusinessUnitChange: (bu: string | undefined) => void;
	projectFilter: "all" | "no_project" | "has_project";
	onProjectFilterChange: (filter: "all" | "no_project" | "has_project") => void;
	search: string;
	onSearchChange: (search: string) => void;
	statusCounts: Record<string, number>;
}

const STATUSES = ["inbox", "assigned", "in_progress", "review", "done"] as const;
const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
const BUS_UNITS = ["automagic", "chemdry", "cross"] as const;

export default function TaskFilters({
	statusFilter,
	onStatusChange,
	priorityFilter,
	onPriorityChange,
	businessUnitFilter,
	onBusinessUnitChange,
	projectFilter,
	onProjectFilterChange,
	search,
	onSearchChange,
	statusCounts,
}: TaskFiltersProps) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
			{/* Search */}
			<input
				type="text"
				placeholder="Search tasks..."
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
				style={{
					width: "100%",
					padding: "8px 12px",
					background: "var(--mc-bg-primary)",
					border: "1px solid var(--mc-border)",
					borderRadius: 6,
					color: "var(--mc-text-primary)",
					fontSize: 13,
				}}
			/>

			{/* Status filter */}
			<div>
				<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
					Status
				</div>
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button
						type="button"
						className={statusFilter === undefined ? "btn-primary" : "btn-secondary"}
						onClick={() => onStatusChange(undefined)}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						All
					</button>
					{STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							className={statusFilter === s ? "btn-primary" : "btn-secondary"}
							onClick={() => onStatusChange(statusFilter === s ? undefined : s)}
							style={{
								padding: "3px 10px",
								fontSize: 11,
								...(statusFilter === s ? { backgroundColor: TASK_STATUS_COLORS[s] } : {}),
							}}
						>
							{s.replace("_", " ")} ({statusCounts[s] || 0})
						</button>
					))}
				</div>
			</div>

			{/* Priority filter */}
			<div>
				<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
					Priority
				</div>
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button
						type="button"
						className={priorityFilter === undefined ? "btn-primary" : "btn-secondary"}
						onClick={() => onPriorityChange(undefined)}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						All
					</button>
					{PRIORITIES.map((p) => (
						<button
							key={p}
							type="button"
							className={priorityFilter === p ? "btn-primary" : "btn-secondary"}
							onClick={() => onPriorityChange(priorityFilter === p ? undefined : p)}
							style={{
								padding: "3px 10px",
								fontSize: 11,
								...(priorityFilter === p ? { backgroundColor: PRIORITY_COLORS[p] } : {}),
							}}
						>
							{p}
						</button>
					))}
				</div>
			</div>

			{/* Business Unit filter */}
			<div>
				<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
					Business Unit
				</div>
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button
						type="button"
						className={businessUnitFilter === undefined ? "btn-primary" : "btn-secondary"}
						onClick={() => onBusinessUnitChange(undefined)}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						All
					</button>
					{BUS_UNITS.map((bu) => (
						<button
							key={bu}
							type="button"
							className={businessUnitFilter === bu ? "btn-primary" : "btn-secondary"}
							onClick={() => onBusinessUnitChange(businessUnitFilter === bu ? undefined : bu)}
							style={{
								padding: "3px 10px",
								fontSize: 11,
								...(businessUnitFilter === bu ? { backgroundColor: BUSINESS_UNIT_COLORS[bu] } : {}),
							}}
						>
							{bu}
						</button>
					))}
				</div>
			</div>

			{/* Project filter */}
			<div>
				<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
					Project
				</div>
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button
						type="button"
						className={projectFilter === "all" ? "btn-primary" : "btn-secondary"}
						onClick={() => onProjectFilterChange("all")}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						All
					</button>
					<button
						type="button"
						className={projectFilter === "no_project" ? "btn-primary" : "btn-secondary"}
						onClick={() => onProjectFilterChange("no_project")}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						No Project
					</button>
					<button
						type="button"
						className={projectFilter === "has_project" ? "btn-primary" : "btn-secondary"}
						onClick={() => onProjectFilterChange("has_project")}
						style={{ padding: "3px 10px", fontSize: 11 }}
					>
						Has Project
					</button>
				</div>
			</div>
		</div>
	);
}
