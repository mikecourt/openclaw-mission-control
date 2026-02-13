import { useCallback, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import ControlTowerQueue from "../components/ControlTowerQueue";
import RightSidebar from "../components/RightSidebar";
import TrayContainer from "../components/Trays/TrayContainer";
import TaskDetailPanel from "../components/TaskDetailPanel";
import AddTaskModal from "../components/AddTaskModal";
import AddProjectModal from "../components/AddProjectModal";
import TriageModal from "../components/TriageModal";

export default function ProjectsPage() {
	const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
	const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
	const [showAddTaskModal, setShowAddTaskModal] = useState(false);
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
		<div style={{ display: "flex", height: "100%", gap: 16, padding: 16, overflow: "hidden" }}>
			<div style={{ flex: 1, overflow: "auto" }}>
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
			</div>
			<div style={{ width: "320px", flexShrink: 0 }}>
				<RightSidebar
					isOpen={isRightSidebarOpen}
					onClose={() => setIsRightSidebarOpen(false)}
					selectedDocumentId={selectedDocumentId}
					onSelectDocument={handleSelectDocument}
					onPreviewDocument={handlePreviewDocument}
				/>
			</div>
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
						setAddTaskPreselectedProjectId(undefined);
					}}
					onCreated={(taskId) => {
						setShowAddTaskModal(false);
						setAddTaskPreselectedProjectId(undefined);
						setSelectedTaskId(taskId);
					}}
					initialAssigneeId={undefined}
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
		</div>
	);
}
