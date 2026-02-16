import { NavLink } from "react-router-dom";
import {
	IconLayoutDashboard,
	IconColumns3,
	IconChecklist,
	IconUsers,
	IconCoin,
	IconToggleRight,
	IconTerminal2,
	IconSettings,
	IconBolt,
	IconShare2,
	IconTool,
	IconExternalLink,
} from "@tabler/icons-react";

const NAV_ITEMS = [
	{ path: "/dashboard", label: "Dashboard", Icon: IconLayoutDashboard },
	{ path: "/projects", label: "Projects", Icon: IconColumns3 },
	{ path: "/tasks", label: "Tasks", Icon: IconChecklist },
	{ path: "/agents", label: "Agents", Icon: IconUsers },
	{ path: "/agents/escalation", label: "Agent Network", Icon: IconShare2 },
	{ path: "/opus", label: "Opus Budget", Icon: IconCoin },
	{ path: "/phase", label: "Phase", Icon: IconToggleRight },
	{ path: "/logs", label: "Activity Log", Icon: IconTerminal2 },
	{ path: "/settings", label: "Settings", Icon: IconSettings },
];

export default function NavSidebar() {
	return (
		<nav className="nav-sidebar">
			<div style={{ padding: "12px 12px 8px", display: "flex", alignItems: "center", gap: 10 }}>
				<IconBolt size={24} style={{ color: "var(--mc-status-active)", flexShrink: 0 }} />
				<span
					style={{
						fontSize: 15,
						fontWeight: 600,
						color: "var(--mc-text-primary)",
						whiteSpace: "nowrap",
						overflow: "hidden",
					}}
				>
					Control Tower
				</span>
			</div>
			<div style={{ marginTop: 8, flex: 1, overflowY: "auto" }}>
				{NAV_ITEMS.map(({ path, label, Icon }) => (
					<NavLink
						key={path}
						to={path}
						className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
					>
						<Icon size={20} />
						<span>{label}</span>
					</NavLink>
				))}
			</div>
			<div className="nav-sidebar-footer">
				<a
					href="http://192.168.4.31:3111"
					target="_blank"
					rel="noopener noreferrer"
					className="nav-item"
				>
					<IconTool size={20} />
					<span>Agent Studio</span>
					<IconExternalLink size={14} className="nav-external-icon" />
				</a>
			</div>
		</nav>
	);
}
