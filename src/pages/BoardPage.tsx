import { useCallback, useEffect, useMemo, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import Header from "../components/Header";
import AgentsSidebar from "../components/AgentsSidebar";
import ControlTowerQueue from "../components/ControlTowerQueue";
import RightSidebar from "../components/RightSidebar";
import TrayContainer from "../components/Trays/TrayContainer";
import TaskDetailPanel from "../components/TaskDetailPanel";
import AddTaskModal from "../components/AddTaskModal";
import AddProjectModal from "../components/AddProjectModal";
import AgentDetailTray from "../components/AgentDetailTray";
import TriageModal from "../components/TriageModal";

export default function BoardPage() {
	const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
	const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

	const closeSidebars = useCallback(() => {
		setIsLeftSidebarOpen(false);
		setIsRightSidebarOpen(false);
	}, []);

	const isAnySidebarOpen = useMemo(
		() => isLeftSidebarOpen || isRightSidebarOpen,
		[isLeftSidebarOpen, isRightSidebarOpen],
	);

	useEffect(() => {
		if (!isAnySidebarOpen) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeSidebars();
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [closeSidebars, isAnySidebarOpen]);
	const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
	const [showAddTaskModal, setShowAddTaskModal] = useState(false);
	const [addTaskPreselectedAgentId, setAddTaskPreselectedAgentId] = useState<string | undefined>(undefined);
	const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(null);
	const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
	const [showAddProjectModal, setShowAddProjectModal] = useState(false);
	const [addTaskPreselectedProjectId, setAddTaskPreselectedProjectId] = useState<Id<"projects"> | undefined>(undefined);
	const [showTriageModal, setShowTriageModal] = useState(false);

	// Document tray state
	const [selectedDocumentId, setSelectedDocumentId] = useState<Id<"documents"> | null>(null);
	const [showConversationTray, setShowConversationTray] = useState(false);
	const [showPreviewTray, setShowPreviewTray] = useState(false);

	const handleSelectDocument = useCallback((id: Id<"documents"> | null) => {
		if (id === null) {
			setSelectedDocumentId(null);
			setShowConversationTray(false);
			setShowPreviewTray(false);
		} else {
			setSelectedDocumentId(id);
			setShowConversationTray(true);
			setShowPreviewTray(true);
		}
	}, []);

	const handlePreviewDocument = useCallback((id: Id<"documents">) => {
		setSelectedDocumentId(id);
		setShowConversationTray(true);
		setShowPreviewTray(true);
	}, []);

	const handleCloseConversation = useCallback(() => {
		setShowConversationTray(false);
		setShowPreviewTray(false);
		setSelectedDocumentId(null);
	}, []);

	const handleClosePreview = useCallback(() => {
		setShowPreviewTray(false);
	}, []);

	const handleOpenPreview = useCallback(() => {
		setShowPreviewTray(true);
	}, []);

	return (
		<main className="app-container">
			<Header
				onOpenAgents={() => {
					setIsLeftSidebarOpen(true);
					setIsRightSidebarOpen(false);
				}}
				onOpenLiveFeed={() => {
					setIsRightSidebarOpen(true);
					setIsLeftSidebarOpen(false);
				}}
				onOpenTriage={() => setShowTriageModal(true)}
			/>

			{isAnySidebarOpen && (
				<div
					className="drawer-backdrop"
					onClick={closeSidebars}
					aria-hidden="true"
				/>
			)}

			<AgentsSidebar
				isOpen={isLeftSidebarOpen}
				onClose={() => setIsLeftSidebarOpen(false)}
				onAddTask={(preselectedAgentId) => {
					setAddTaskPreselectedAgentId(preselectedAgentId);
					setShowAddTaskModal(true);
				}}
				onSelectAgent={(agentId) => setSelectedAgentId(agentId as Id<"agents">)}
			/>
			<ControlTowerQueue
				selectedTaskId={selectedTaskId}
				onSelectTask={setSelectedTaskId}
				selectedProjectId={selectedProjectId}
				onSelectProject={setSelectedProjectId}
				onAddProject={() => setShowAddProjectModal(true)}
				onAddTask={() => {
					setAddTaskPreselectedProjectId(selectedProjectId ?? undefined);
					setShowAddTaskModal(true);
				}}
			/>
			<RightSidebar
				isOpen={isRightSidebarOpen}
				onClose={() => setIsRightSidebarOpen(false)}
				selectedDocumentId={selectedDocumentId}
				onSelectDocument={handleSelectDocument}
				onPreviewDocument={handlePreviewDocument}
			/>
			<TrayContainer
				selectedDocumentId={selectedDocumentId}
				showConversation={showConversationTray}
				showPreview={showPreviewTray}
				onCloseConversation={handleCloseConversation}
				onClosePreview={handleClosePreview}
				onOpenPreview={handleOpenPreview}
			/>
			{showAddTaskModal && (
				<AddTaskModal
					onClose={() => {
						setShowAddTaskModal(false);
						setAddTaskPreselectedAgentId(undefined);
						setAddTaskPreselectedProjectId(undefined);
					}}
					onCreated={(taskId) => {
						setShowAddTaskModal(false);
						setAddTaskPreselectedAgentId(undefined);
						setAddTaskPreselectedProjectId(undefined);
						setSelectedTaskId(taskId);
					}}
					initialAssigneeId={addTaskPreselectedAgentId}
					initialProjectId={addTaskPreselectedProjectId}
				/>
			)}
			{showAddProjectModal && (
				<AddProjectModal
					onClose={() => setShowAddProjectModal(false)}
					onCreated={(projectId) => {
						setShowAddProjectModal(false);
						setSelectedProjectId(projectId);
					}}
				/>
			)}
			{selectedAgentId && (
				<div
					className="fixed inset-0 z-[99]"
					onClick={() => setSelectedAgentId(null)}
					aria-hidden="true"
				/>
			)}
			<AgentDetailTray
				agentId={selectedAgentId}
				onClose={() => setSelectedAgentId(null)}
			/>
			{showTriageModal && (
				<TriageModal
					onClose={() => setShowTriageModal(false)}
					onSelectTask={(taskId) => {
						setShowTriageModal(false);
						setSelectedTaskId(taskId);
					}}
				/>
			)}
			{selectedTaskId && (
				<>
					<div
						className="fixed inset-0 z-40"
						onClick={() => setSelectedTaskId(null)}
						aria-hidden="true"
					/>
					<TaskDetailPanel
						taskId={selectedTaskId}
						onClose={() => setSelectedTaskId(null)}
						onPreviewDocument={handlePreviewDocument}
					/>
				</>
			)}
		</main>
	);
}
