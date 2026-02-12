import { Outlet } from "react-router-dom";
import NavSidebar from "./NavSidebar";
import TopBar from "./TopBar";

export default function AppShell() {
	return (
		<div className="app-shell">
			<NavSidebar />
			<TopBar />
			<div className="main-content">
				<Outlet />
			</div>
		</div>
	);
}
