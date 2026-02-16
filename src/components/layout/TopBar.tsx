import { useLocation, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../../lib/tenant";

const ROUTE_LABELS: Record<string, string> = {
	"/dashboard": "Dashboard",
	"/projects": "Projects",
	"/tasks": "Tasks",
	"/agents": "Agents",
	"/agents/escalation": "Agent Network",
	"/opus": "Opus Budget",
	"/phase": "Phase Manager",
	"/logs": "Activity Log",
	"/settings": "Settings",
};

export default function TopBar() {
	const location = useLocation();
	const planUsage = useQuery(api.queries.getPlanUsage, { tenantId: DEFAULT_TENANT_ID });

	// Determine breadcrumb from path
	const pathSegments = location.pathname.split("/").filter(Boolean);
	const fullPath = `/${pathSegments.join("/")}`;
	const basePath = `/${pathSegments[0] || "dashboard"}`;
	// Check if the full path is a known route (e.g. /agents/escalation)
	const fullPathLabel = ROUTE_LABELS[fullPath];
	const baseLabel = ROUTE_LABELS[basePath] || pathSegments[0] || "Dashboard";
	const hasDetail = pathSegments.length > 1;

	const sessionPct = planUsage?.session?.pct ?? 0;
	const weeklyPct = planUsage?.weekly?.pct ?? 0;

	// Format reset time helper
	const formatResetTime = (ms: number) => {
		if (ms <= 0) return "";
		const hours = Math.floor(ms / (60 * 60 * 1000));
		const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
		if (hours >= 24) return `${Math.floor(hours / 24)}d`;
		if (hours > 0) return `${hours}h`;
		return `${minutes}m`;
	};

	return (
		<div className="mc-topbar" style={{ gridColumn: 2, gridRow: 1 }}>
			<div className="breadcrumb">
				<Link to="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>
					CT
				</Link>
				<span style={{ opacity: 0.4 }}>/</span>
				{hasDetail ? (
					<>
						<Link to={basePath} style={{ color: "inherit", textDecoration: "none" }}>
							{baseLabel}
						</Link>
						<span style={{ opacity: 0.4 }}>/</span>
						<span className="current">{fullPathLabel || pathSegments[1]}</span>
					</>
				) : (
					<span className="current">{baseLabel}</span>
				)}
			</div>

			<div style={{ flex: 1 }} />

			{/* Plan usage indicators */}
			{planUsage && (
				<div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11 }}>
					<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							<span style={{ color: "var(--mc-text-muted)" }}>Session</span>
							<span
								style={{
									color:
										sessionPct > 80
											? "var(--mc-status-error)"
											: sessionPct > 60
												? "var(--mc-status-warn)"
												: "var(--mc-status-ok)",
									fontWeight: 600,
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{sessionPct}%
							</span>
						</div>
						{planUsage.session?.resetMs && (
							<span style={{ fontSize: 9, color: "var(--mc-text-muted)", opacity: 0.7 }}>
								resets {formatResetTime(planUsage.session.resetMs)}
							</span>
						)}
					</div>
					<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							<span style={{ color: "var(--mc-text-muted)" }}>Weekly</span>
							<span
								style={{
									color:
										weeklyPct > 80
											? "var(--mc-status-error)"
											: weeklyPct > 60
												? "var(--mc-status-warn)"
												: "var(--mc-status-ok)",
									fontWeight: 600,
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{weeklyPct}%
							</span>
						</div>
						{planUsage.weekly?.resetMs && (
							<span style={{ fontSize: 9, color: "var(--mc-text-muted)", opacity: 0.7 }}>
								resets {formatResetTime(planUsage.weekly.resetMs)}
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
