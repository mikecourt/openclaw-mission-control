"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { Routes, Route, Navigate } from "react-router-dom";
import SignInForm from "./components/SignIn";
import AppShell from "./components/layout/AppShell";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import ProjectsPage from "./pages/ProjectsPage";
import DashboardPage from "./pages/DashboardPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import AgentsPage from "./pages/AgentsPage";
import AgentDetailPage from "./pages/AgentDetailPage";
import OpusPage from "./pages/OpusPage";
import PhasePage from "./pages/PhasePage";
import LogsPage from "./pages/LogsPage";
import SettingsPage from "./pages/SettingsPage";
import EscalationNetworkPage from "./pages/EscalationNetworkPage";

function EB({ children }: { children: React.ReactNode }) {
	return <ErrorBoundary>{children}</ErrorBoundary>;
}

const routes = (
	<Routes>
		<Route element={<AppShell />}>
			<Route path="/dashboard" element={<EB><DashboardPage /></EB>} />
			<Route path="/projects" element={<EB><ProjectsPage /></EB>} />
			<Route path="/tasks" element={<EB><TasksPage /></EB>} />
			<Route path="/tasks/:id" element={<EB><TaskDetailPage /></EB>} />
			<Route path="/agents" element={<EB><AgentsPage /></EB>} />
			<Route path="/agents/escalation" element={<EB><EscalationNetworkPage /></EB>} />
			<Route path="/agents/:id" element={<EB><AgentDetailPage /></EB>} />
			<Route path="/opus" element={<EB><OpusPage /></EB>} />
			<Route path="/phase" element={<EB><PhasePage /></EB>} />
			<Route path="/logs" element={<EB><LogsPage /></EB>} />
			<Route path="/settings" element={<EB><SettingsPage /></EB>} />
		</Route>
		<Route path="/board" element={<Navigate to="/projects" replace />} />
		<Route path="/" element={<Navigate to="/dashboard" replace />} />
		<Route path="*" element={<Navigate to="/dashboard" replace />} />
	</Routes>
);

export default function App() {
	// TEMP: bypass auth for visual testing
	const bypassAuth = new URLSearchParams(window.location.search).get("noauth") === "1";

	if (bypassAuth) {
		return routes;
	}

	return (
		<>
			<Authenticated>{routes}</Authenticated>
			<Unauthenticated>
				<SignInForm />
			</Unauthenticated>
		</>
	);
}
