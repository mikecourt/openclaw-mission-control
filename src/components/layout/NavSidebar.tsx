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
} from "@tabler/icons-react";

const NAV_ITEMS = [
	{ path: "/dashboard", label: "Dashboard", Icon: IconLayoutDashboard },
	{ path: "/board", label: "Board", Icon: IconColumns3 },
	{ path: "/tasks", label: "Tasks", Icon: IconChecklist },
	{ path: "/agents", label: "Agents", Icon: IconUsers },
	{ path: "/agents/escalation", label: "Escalation Map", Icon: IconShare2 },
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
					Mission Control
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
		</nav>
	);
}
