import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../../lib/tenant";
import { IconX } from "@tabler/icons-react";

interface TaskSubmitModalProps {
	open: boolean;
	onClose: () => void;
}

export default function TaskSubmitModal({ open, onClose }: TaskSubmitModalProps) {
	const createTask = useMutation(api.tasks.createTask);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState<string>("medium");
	const [tags, setTags] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (!open) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;

		setSubmitting(true);
		try {
			await createTask({
				title: title.trim(),
				description: description.trim(),
				status: "inbox",
				tags: tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				priority,
				source: "manual",
				tenantId: DEFAULT_TENANT_ID,
			});
			setTitle("");
			setDescription("");
			setPriority("medium");
			setTags("");
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0,0,0,0.6)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 1000,
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				style={{
					background: "var(--mc-bg-card)",
					border: "1px solid var(--mc-border)",
					borderRadius: 12,
					width: 480,
					maxWidth: "90vw",
					padding: 24,
				}}
			>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
					<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--mc-text-primary)", margin: 0 }}>
						New Task
					</h2>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "none",
							border: "none",
							color: "var(--mc-text-muted)",
							cursor: "pointer",
							padding: 4,
						}}
					>
						<IconX size={18} />
					</button>
				</div>

				<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
					<div>
						<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
							Title *
						</label>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Task title..."
							required
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
					</div>

					<div>
						<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
							Description
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Task description..."
							rows={4}
							style={{
								width: "100%",
								padding: "8px 12px",
								background: "var(--mc-bg-primary)",
								border: "1px solid var(--mc-border)",
								borderRadius: 6,
								color: "var(--mc-text-primary)",
								fontSize: 13,
								resize: "vertical",
								fontFamily: "inherit",
							}}
						/>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
						<div>
							<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
								Priority
							</label>
							<select
								value={priority}
								onChange={(e) => setPriority(e.target.value)}
								style={{
									width: "100%",
									padding: "8px 12px",
									background: "var(--mc-bg-primary)",
									border: "1px solid var(--mc-border)",
									borderRadius: 6,
									color: "var(--mc-text-primary)",
									fontSize: 13,
								}}
							>
								<option value="urgent">Urgent</option>
								<option value="high">High</option>
								<option value="medium">Medium</option>
								<option value="low">Low</option>
							</select>
						</div>

						<div>
							<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
								Tags (comma-separated)
							</label>
							<input
								type="text"
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								placeholder="e.g. openclaw, urgent"
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
						</div>
					</div>

					<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
						<button type="button" className="btn-secondary" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="btn-primary" disabled={submitting || !title.trim()}>
							{submitting ? "Creating..." : "Create Task"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
