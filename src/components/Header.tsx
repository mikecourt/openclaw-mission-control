import React, { useEffect, useState } from "react";
import SignOutButton from "./Signout";
import GatewayTroubleshooter from "./GatewayTroubleshooter";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { IconAlertTriangle, IconAirTrafficControl } from "@tabler/icons-react";
import { getEffectiveStatuses } from "../lib/status";

type HeaderProps = {
	onOpenAgents?: () => void;
	onOpenLiveFeed?: () => void;
	onOpenTriage?: () => void;
};

const Header: React.FC<HeaderProps> = ({ onOpenAgents, onOpenLiveFeed, onOpenTriage }) => {
	const [time, setTime] = useState(new Date());

	// Fetch data for dynamic counts
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const projects = useQuery(api.projects.listAll, { tenantId: DEFAULT_TENANT_ID });
	const needsInput = useQuery(api.queries.getNeedsInput, { tenantId: DEFAULT_TENANT_ID });
	const usageSummary = useQuery(api.queries.getUsageSummary, { tenantId: DEFAULT_TENANT_ID });
	const planUsage = useQuery(api.queries.getPlanUsage, { tenantId: DEFAULT_TENANT_ID });

	// Calculate counts using effective (computed) status
	const effectiveStatuses = agents && tasks ? getEffectiveStatuses(agents, tasks) : null;
	const activeAgentsCount = effectiveStatuses ? Array.from(effectiveStatuses.values()).filter(s => s === "active").length : 0;
	const tasksInQueueCount = tasks ? tasks.filter(t => t.status !== "done" && t.status !== "archived").length : 0;
	const projectsInQueueCount = projects ? projects.filter(p => p.status !== "complete" && p.status !== "archived").length : 0;
	const needsYouCount = needsInput?.length ?? 0;

	useEffect(() => {
		const timer = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour12: true,
			hour: "numeric",
			minute: "2-digit",
		});
	};

	const formatDate = (date: Date) => {
		return date
			.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			})
			.toUpperCase();
	};

	const budgetColor = (pct: number) =>
		pct > 80 ? "var(--accent-red)" : pct > 60 ? "var(--accent-orange)" : "var(--accent-green)";

	const formatResetTime = (ms: number) => {
		if (ms <= 0) return "";
		const hours = Math.floor(ms / (60 * 60 * 1000));
		const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
		if (hours >= 24) return `${Math.floor(hours / 24)}d`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

	return (
		<header className="[grid-area:header] flex items-center justify-between px-3 md:px-6 bg-card border-b border-border z-10">
			<div className="flex items-center gap-2 md:gap-4 min-w-0">
				<div className="flex md:hidden items-center gap-2">
					<button
						type="button"
						className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
						onClick={onOpenAgents}
						aria-label="Open agents sidebar"
					>
						<span aria-hidden="true">☰</span>
					</button>
				</div>
				<div className="flex items-center gap-2 min-w-0">
					<IconAirTrafficControl size={24} className="text-[var(--accent-orange)]" />
					<h1 className="text-base md:text-lg font-semibold tracking-wider text-foreground truncate">
						CONTROL TOWER
					</h1>
				</div>
				<div className="hidden sm:block text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
					Automagic AI & Chem-Dry
				</div>
			</div>

			<div className="hidden md:flex items-center gap-6">
				{needsYouCount > 0 && (
					<>
						<button
							onClick={onOpenTriage}
							className="flex flex-col items-center hover:bg-[var(--accent-orange)]/10 rounded-lg px-2 py-1 transition-colors cursor-pointer"
						>
							<div className="text-2xl font-bold text-[var(--accent-orange)] flex items-center gap-1">
								<IconAlertTriangle size={18} />
								{needsYouCount}
							</div>
							<div className="text-[10px] font-semibold text-[var(--accent-orange)] tracking-tighter">
								NEEDS YOU
							</div>
						</button>
						<div className="w-px h-8 bg-border" />
					</>
				)}
				<div className="flex flex-col items-center">
					<div className="text-2xl font-bold text-foreground">
						{agents ? activeAgentsCount : "-"}
					</div>
					<div className="text-[10px] font-semibold text-muted-foreground tracking-tighter">
						AGENTS ACTIVE
					</div>
				</div>
				<div className="w-px h-8 bg-border" />
				<div className="flex flex-col items-center">
					<div className="text-2xl font-bold text-foreground">
						{tasks ? tasksInQueueCount : "-"}
					</div>
					<div className="text-[10px] font-semibold text-muted-foreground tracking-tighter">
						TASKS IN QUEUE
					</div>
				</div>
				<div className="w-px h-8 bg-border" />
				<div className="flex flex-col items-center">
					<div className="text-2xl font-bold text-foreground">
						{projects ? projectsInQueueCount : "-"}
					</div>
					<div className="text-[10px] font-semibold text-muted-foreground tracking-tighter">
						PROJECTS
					</div>
				</div>
				{usageSummary && usageSummary.todayCost > 0 && (
					<>
						<div className="w-px h-8 bg-border" />
						<div className="flex flex-col items-center">
							<div className="text-lg font-bold text-foreground font-mono">
								${usageSummary.todayCost.toFixed(2)}
							</div>
							<div className="text-[10px] font-semibold text-muted-foreground tracking-tighter">
								TODAY
							</div>
						</div>
						<div className="flex flex-col items-center">
							<div className="text-lg font-bold text-muted-foreground font-mono">
								${usageSummary.mtdCost.toFixed(2)}
							</div>
							<div className="text-[10px] font-semibold text-muted-foreground tracking-tighter">
								MTD
							</div>
						</div>
					</>
				)}
				{planUsage && (
					<>
						<div className="w-px h-8 bg-border" />
						<div className="flex flex-col items-center">
							<div className="text-2xl font-bold" style={{ color: budgetColor(planUsage.session.pct) }}>
								{planUsage.session.pct}%
							</div>
							<div className="text-[10px] font-semibold tracking-tighter" style={{ color: budgetColor(planUsage.session.pct) }}>
								SESSION • {formatResetTime(planUsage.session.resetMs)}
							</div>
						</div>
						<div className="w-px h-8 bg-border" />
						<div className="flex flex-col items-center">
							<div className="text-2xl font-bold" style={{ color: budgetColor(planUsage.weekly.pct) }}>
								{planUsage.weekly.pct}%
							</div>
							<div className="text-[10px] font-semibold tracking-tighter" style={{ color: budgetColor(planUsage.weekly.pct) }}>
								WEEKLY • {formatResetTime(planUsage.weekly.resetMs)}
							</div>
						</div>
					</>
				)}
			</div>

			<div className="flex items-center gap-2 md:gap-6">
				<button
					type="button"
					className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
					onClick={onOpenLiveFeed}
					aria-label="Open live feed sidebar"
				>
					<span aria-hidden="true">☰</span>
				</button>
				<div className="text-right">
					<div className="text-xl font-semibold text-foreground tabular-nums">
						{formatTime(time)}
					</div>
					<div className="text-[10px] font-medium text-muted-foreground tracking-[0.5px]">
						{formatDate(time)}
					</div>
				</div>
				<div className="flex items-center gap-2 bg-[var(--accent-green)]/15 text-[var(--accent-green)] px-3 py-1.5 rounded-full text-[11px] font-bold tracking-[0.5px]">
					<span className="w-2 h-2 bg-[var(--accent-green)] rounded-full" />
					ONLINE
				</div>
				<GatewayTroubleshooter />
				<SignOutButton />
			</div>
		</header>
	);
};

export default Header;
