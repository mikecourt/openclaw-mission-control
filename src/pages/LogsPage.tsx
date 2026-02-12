import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { formatRelativeTime } from "../lib/utils";

const LEVEL_COLORS: Record<string, string> = {
	info: "#3b82f6",
	warn: "#eab308",
	error: "#ef4444",
	debug: "#6b7280",
};

export default function LogsPage() {
	const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined);
	const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
	const [searchText, setSearchText] = useState("");
	const [autoScroll, setAutoScroll] = useState(true);
	const logContainerRef = useRef<HTMLDivElement>(null);

	const logs = useQuery(api.activityLog.getActivityLog, {
		tenantId: DEFAULT_TENANT_ID,
		level: levelFilter,
		source: sourceFilter,
		limit: 200,
	});

	// Also show existing activities as a fallback
	const activities = useQuery(api.queries.listActivities, { tenantId: DEFAULT_TENANT_ID });

	// Collect unique sources for the filter dropdown
	const uniqueSources = useMemo(() => {
		if (!logs || logs.length === 0) return [];
		const sources = new Set<string>();
		for (const log of logs) {
			if (log.source) sources.add(log.source);
		}
		return Array.from(sources).sort();
	}, [logs]);

	// Apply text search filter in-memory
	const filteredLogs = useMemo(() => {
		const items = logs || [];
		if (!searchText.trim()) return items;
		const query = searchText.toLowerCase();
		return items.filter(
			(log) =>
				log.message.toLowerCase().includes(query) ||
				log.source.toLowerCase().includes(query) ||
				(log.agentId && log.agentId.toLowerCase().includes(query)),
		);
	}, [logs, searchText]);

	const filteredActivities = useMemo(() => {
		const items = activities || [];
		if (filteredLogs.length > 0) return []; // only used as fallback
		if (!searchText.trim()) return items;
		const query = searchText.toLowerCase();
		return items.filter(
			(a) =>
				a.message.toLowerCase().includes(query) ||
				a.agentName.toLowerCase().includes(query),
		);
	}, [activities, searchText, filteredLogs.length]);

	const visibleCount = filteredLogs.length > 0 ? filteredLogs.length : filteredActivities.length;

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (autoScroll && logContainerRef.current) {
			logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
		}
	}, [filteredLogs, filteredActivities, autoScroll]);

	// Export visible logs as JSON
	const handleExport = useCallback(() => {
		const dataToExport = filteredLogs.length > 0 ? filteredLogs : filteredActivities;
		const json = JSON.stringify(dataToExport, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `activity-log-${new Date().toISOString().slice(0, 19)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [filteredLogs, filteredActivities]);

	return (
		<div>
			<div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<h1>Activity Log</h1>
				<span style={{ fontSize: 13, color: "var(--mc-text-muted)" }}>
					{visibleCount} {visibleCount === 1 ? "entry" : "entries"}
				</span>
			</div>

			{/* Filters row */}
			<div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
				{/* Level filters */}
				<button
					className={levelFilter === undefined ? "btn-primary" : "btn-secondary"}
					onClick={() => setLevelFilter(undefined)}
					style={{ padding: "4px 12px", fontSize: 12 }}
					type="button"
				>
					All
				</button>
				{["info", "warn", "error", "debug"].map((level) => (
					<button
						key={level}
						className={levelFilter === level ? "btn-primary" : "btn-secondary"}
						onClick={() => setLevelFilter(level)}
						style={{
							padding: "4px 12px",
							fontSize: 12,
							...(levelFilter === level ? { backgroundColor: LEVEL_COLORS[level] } : {}),
						}}
						type="button"
					>
						{level}
					</button>
				))}

				{/* Divider */}
				<span style={{ width: 1, height: 20, background: "var(--mc-border, #333)", margin: "0 4px" }} />

				{/* Source filter dropdown */}
				<select
					value={sourceFilter ?? ""}
					onChange={(e) => setSourceFilter(e.target.value || undefined)}
					style={{
						padding: "4px 8px",
						fontSize: 12,
						background: "var(--mc-bg-card, #1e1e2e)",
						color: "var(--mc-text-primary, #fff)",
						border: "1px solid var(--mc-border, #333)",
						borderRadius: 4,
						cursor: "pointer",
					}}
				>
					<option value="">All sources</option>
					{uniqueSources.map((src) => (
						<option key={src} value={src}>
							{src}
						</option>
					))}
				</select>

				{/* Text search */}
				<input
					type="text"
					placeholder="Search messages..."
					value={searchText}
					onChange={(e) => setSearchText(e.target.value)}
					style={{
						padding: "4px 10px",
						fontSize: 12,
						background: "var(--mc-bg-card, #1e1e2e)",
						color: "var(--mc-text-primary, #fff)",
						border: "1px solid var(--mc-border, #333)",
						borderRadius: 4,
						flex: "0 1 200px",
						minWidth: 120,
					}}
				/>

				{/* Spacer */}
				<div style={{ flex: 1 }} />

				{/* Auto-scroll toggle */}
				<button
					className={autoScroll ? "btn-primary" : "btn-secondary"}
					onClick={() => setAutoScroll((v) => !v)}
					style={{ padding: "4px 10px", fontSize: 12 }}
					type="button"
				>
					{autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
				</button>

				{/* Export button */}
				<button
					className="btn-secondary"
					onClick={handleExport}
					style={{ padding: "4px 10px", fontSize: 12 }}
					type="button"
				>
					Export JSON
				</button>
			</div>

			{/* Structured logs */}
			<div
				ref={logContainerRef}
				className="metric-card"
				style={{
					fontFamily: "var(--font-mono)",
					fontSize: 12,
					maxHeight: "60vh",
					overflowY: "auto",
					padding: 0,
				}}
			>
				{filteredLogs.length > 0 ? (
					filteredLogs.map((log) => (
						<div
							key={log._id}
							style={{
								padding: "6px 12px",
								borderBottom: "1px solid var(--mc-border)",
								display: "flex",
								gap: 12,
								alignItems: "flex-start",
							}}
						>
							<span style={{ color: LEVEL_COLORS[log.level] || "#6b7280", width: 40, flexShrink: 0, textTransform: "uppercase", fontWeight: 600 }}>
								{log.level}
							</span>
							<span style={{ color: "var(--mc-text-muted)", width: 60, flexShrink: 0 }}>
								{formatRelativeTime(log.timestamp)}
							</span>
							<span style={{ color: "var(--mc-text-secondary)", width: 80, flexShrink: 0 }}>
								{log.source}
							</span>
							<span style={{ color: "var(--mc-text-primary)", flex: 1 }}>
								{log.message}
							</span>
							{log.taskId && (
								<Link
									to={`/tasks/${log.taskId}`}
									style={{
										color: "#3b82f6",
										fontSize: 11,
										flexShrink: 0,
										textDecoration: "none",
									}}
									onClick={(e) => e.stopPropagation()}
								>
									view task
								</Link>
							)}
						</div>
					))
				) : (
					/* Fallback to existing activities */
					filteredActivities.map((activity) => (
						<div
							key={activity._id}
							style={{
								padding: "6px 12px",
								borderBottom: "1px solid var(--mc-border)",
								display: "flex",
								gap: 12,
								alignItems: "flex-start",
							}}
						>
							<span style={{ color: "#3b82f6", width: 40, flexShrink: 0, textTransform: "uppercase", fontWeight: 600 }}>
								INFO
							</span>
							<span style={{ color: "var(--mc-text-muted)", width: 60, flexShrink: 0 }}>
								{formatRelativeTime(activity._creationTime)}
							</span>
							<span style={{ color: "var(--mc-text-secondary)", width: 80, flexShrink: 0 }}>
								{activity.agentName}
							</span>
							<span style={{ color: "var(--mc-text-primary)", flex: 1 }}>
								{activity.message}
							</span>
						</div>
					))
				)}
				{filteredLogs.length === 0 && filteredActivities.length === 0 && (
					<div style={{ padding: 20, textAlign: "center", color: "var(--mc-text-muted)" }}>
						No log entries yet. Events will appear here as agents run.
					</div>
				)}
			</div>
		</div>
	);
}
