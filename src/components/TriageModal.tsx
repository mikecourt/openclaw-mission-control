import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { IconX, IconCheck, IconArrowRight, IconMessage, IconPlayerPlay } from "@tabler/icons-react";
import { DEFAULT_TENANT_ID } from "../lib/tenant";

interface TriageModalProps {
	onClose: () => void;
	onSelectTask: (taskId: Id<"tasks">) => void;
}

const TriageModal: React.FC<TriageModalProps> = ({ onClose, onSelectTask }) => {
	const items = useQuery(api.queries.getNeedsInput, { tenantId: DEFAULT_TENANT_ID });
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const updateStatus = useMutation(api.tasks.updateStatus);
	const sendMessage = useMutation(api.messages.send);
	const linkRun = useMutation(api.tasks.linkRun);
	const convex = useConvex();

	const [currentIndex, setCurrentIndex] = useState(0);
	const [showReply, setShowReply] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);

	const currentUserAgent = agents?.find(a => a.name === "Mike");
	const total = items?.length ?? 0;
	const safeIndex = Math.min(currentIndex, Math.max(0, total - 1));
	const current = items?.[safeIndex] ?? null;

	// Keep index in bounds when items change (reactive removal)
	useEffect(() => {
		if (total > 0 && currentIndex >= total) {
			setCurrentIndex(Math.max(0, total - 1));
		}
	}, [total, currentIndex]);

	const advance = useCallback(() => {
		setShowReply(false);
		setReplyText("");
		// Don't increment — Convex will remove the resolved item, shifting the list
		// If we're at the end, stay at the new last item
		if (safeIndex >= total - 1) {
			setCurrentIndex(Math.max(0, total - 2));
		}
	}, [safeIndex, total]);

	const handleSkip = useCallback(() => {
		setShowReply(false);
		setReplyText("");
		setCurrentIndex((prev) => (prev + 1) % Math.max(1, total));
	}, [total]);

	const buildPrompt = async (task: NonNullable<typeof current>) => {
		const assignee = task.assigneeIds.length > 0
			? agents?.find(a => a._id === task.assigneeIds[0])
			: null;

		let prompt = "";
		if (assignee) {
			const parts: string[] = [];
			if (assignee.systemPrompt) parts.push(`System Prompt:\n${assignee.systemPrompt}`);
			if (assignee.character) parts.push(`Character:\n${assignee.character}`);
			if (assignee.lore) parts.push(`Lore:\n${assignee.lore}`);
			if (parts.length > 0) prompt = parts.join("\n\n") + "\n\n---\n\n";
		}

		prompt += task.description && task.description !== task.title
			? `${task.title}\n\n${task.description}`
			: task.title;

		const messages = await convex.query(api.queries.listMessages, {
			taskId: task._id,
			tenantId: DEFAULT_TENANT_ID,
		});
		if (messages && messages.length > 0) {
			const sorted = [...messages].sort((a, b) => a._creationTime - b._creationTime);
			const thread = sorted.map(m => `[${m.agentName}]: ${m.content}`).join("\n\n");
			prompt += `\n\n---\nConversation:\n${thread}\n---\nContinue working on this task based on the conversation above.`;
		}

		return prompt;
	};

	const triggerAgent = async (taskId: Id<"tasks">, message: string) => {
		try {
			const res = await fetch("/hooks/agent", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_OPENCLAW_HOOK_TOKEN || ""}`,
				},
				body: JSON.stringify({
					message,
					sessionKey: `mission:${taskId}`,
					name: "MissionControl",
					wakeMode: "now",
				}),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.runId) {
					await linkRun({
						taskId,
						openclawRunId: data.runId,
						tenantId: DEFAULT_TENANT_ID,
					});
				}
			}
		} catch (err) {
			console.error("[TriageModal] Failed to trigger agent:", err);
		}
	};

	const handleApprove = useCallback(async () => {
		if (!current || !currentUserAgent || isProcessing) return;
		setIsProcessing(true);

		try {
			if (current.status === "review") {
				// Mark done
				await updateStatus({
					taskId: current._id,
					status: "done",
					agentId: currentUserAgent._id,
					tenantId: DEFAULT_TENANT_ID,
				});
			} else if (current.needsInput) {
				// Clear flag, move to in_progress, trigger agent
				await updateStatus({
					taskId: current._id,
					status: "in_progress",
					agentId: currentUserAgent._id,
					tenantId: DEFAULT_TENANT_ID,
				});

				const prompt = await buildPrompt(current);
				await triggerAgent(current._id, prompt);
			}
			advance();
		} finally {
			setIsProcessing(false);
		}
	}, [current, currentUserAgent, isProcessing, advance]);

	const handleReplyAndResume = useCallback(async () => {
		if (!current || !currentUserAgent || isProcessing) return;
		const trimmed = replyText.trim();
		if (!trimmed) return;
		setIsProcessing(true);

		try {
			// Send the message
			await sendMessage({
				taskId: current._id,
				agentId: currentUserAgent._id,
				content: trimmed,
				attachments: [],
				tenantId: DEFAULT_TENANT_ID,
			});

			// Move to in_progress (also clears needsInput)
			await updateStatus({
				taskId: current._id,
				status: "in_progress",
				agentId: currentUserAgent._id,
				tenantId: DEFAULT_TENANT_ID,
			});

			// Build prompt including the reply we just sent
			let prompt = "";
			const assignee = current.assigneeIds.length > 0
				? agents?.find(a => a._id === current.assigneeIds[0])
				: null;
			if (assignee) {
				const parts: string[] = [];
				if (assignee.systemPrompt) parts.push(`System Prompt:\n${assignee.systemPrompt}`);
				if (assignee.character) parts.push(`Character:\n${assignee.character}`);
				if (assignee.lore) parts.push(`Lore:\n${assignee.lore}`);
				if (parts.length > 0) prompt = parts.join("\n\n") + "\n\n---\n\n";
			}

			prompt += current.description && current.description !== current.title
				? `${current.title}\n\n${current.description}`
				: current.title;

			const messages = await convex.query(api.queries.listMessages, {
				taskId: current._id,
				tenantId: DEFAULT_TENANT_ID,
			});
			const allMessages = messages ? [...messages].sort((a, b) => a._creationTime - b._creationTime) : [];
			// Append the reply we just sent
			allMessages.push({
				_id: "" as any,
				_creationTime: Date.now(),
				agentName: currentUserAgent.name,
				content: trimmed,
			} as any);

			if (allMessages.length > 0) {
				const thread = allMessages.map(m => `[${m.agentName}]: ${m.content}`).join("\n\n");
				prompt += `\n\n---\nConversation:\n${thread}\n---\nContinue working on this task based on the conversation above.`;
			}

			await triggerAgent(current._id, prompt);
			advance();
		} finally {
			setIsProcessing(false);
		}
	}, [current, currentUserAgent, isProcessing, replyText, advance]);

	const handleOpenDetails = useCallback(() => {
		if (current) {
			onSelectTask(current._id);
			onClose();
		}
	}, [current, onSelectTask, onClose]);

	// Keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Don't capture when typing in textarea
			if (e.target instanceof HTMLTextAreaElement) return;

			switch (e.key.toLowerCase()) {
				case "a":
					handleApprove();
					break;
				case "r":
					setShowReply(prev => !prev);
					break;
				case "s":
					handleSkip();
					break;
				case "escape":
					onClose();
					break;
				case "arrowleft":
					setCurrentIndex(prev => Math.max(0, prev - 1));
					break;
				case "arrowright":
					setCurrentIndex(prev => Math.min(total - 1, prev + 1));
					break;
			}
		};

		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [handleApprove, handleSkip, onClose, total]);

	const getReasonBadge = (task: NonNullable<typeof current>) => {
		if (task.needsInput && task.status === "review") return "Input + Review";
		if (task.needsInput) return "Needs Input";
		return "Review";
	};

	const getAgentName = (id: string) => {
		return agents?.find(a => a._id === id)?.name || "Unknown";
	};

	const formatTime = (timestamp: number) => {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	};

	// Empty state
	if (items && items.length === 0) {
		return (
			<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
				<div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4">
					<div className="flex items-center justify-between px-5 py-4 border-b border-border">
						<span className="text-xs font-bold tracking-widest text-muted-foreground">TRIAGE</span>
						<button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
							<IconX size={18} />
						</button>
					</div>
					<div className="flex flex-col items-center justify-center py-16 gap-3">
						<div className="w-12 h-12 rounded-full bg-[var(--accent-green)]/20 flex items-center justify-center">
							<IconCheck size={24} className="text-[var(--accent-green)]" />
						</div>
						<p className="text-lg font-semibold text-foreground">All caught up!</p>
						<p className="text-sm text-muted-foreground">No items need your attention right now.</p>
					</div>
				</div>
			</div>
		);
	}

	if (!current) return null;

	const progressPct = total > 0 ? ((safeIndex + 1) / total) * 100 : 0;

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
			<div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="flex items-center gap-3">
						<span className="text-xs font-bold tracking-widest text-muted-foreground">TRIAGE</span>
						<span className="text-xs text-muted-foreground font-mono">
							{safeIndex + 1} of {total}
						</span>
					</div>
					<button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
						<IconX size={18} />
					</button>
				</div>

				{/* Progress bar */}
				<div className="h-1 bg-muted">
					<div
						className="h-full bg-[var(--accent-orange)] transition-all duration-300"
						style={{ width: `${progressPct}%` }}
					/>
				</div>

				{/* Card content */}
				<div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
					{/* Reason badge */}
					<div className="flex items-center gap-2">
						<span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] uppercase tracking-wider">
							{getReasonBadge(current)}
						</span>
						{current.priority && (
							<span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
								current.priority === "urgent" ? "bg-red-500/15 text-red-500" :
								current.priority === "high" ? "bg-orange-500/15 text-orange-500" :
								"bg-muted text-muted-foreground"
							}`}>
								{current.priority}
							</span>
						)}
						<span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider font-medium">
							{current.status}
						</span>
					</div>

					{/* Project name */}
					{current.projectName && (
						<div className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
							{current.projectName}
						</div>
					)}

					{/* Title */}
					<h3 className="text-base font-bold text-foreground leading-snug">
						{current.title}
					</h3>

					{/* Description */}
					{current.description && current.description !== current.title && (
						<p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
							{current.description}
						</p>
					)}

					{/* Assignees */}
					{current.assigneeIds.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{current.assigneeIds.map(id => (
								<span key={id} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
									{getAgentName(id)}
								</span>
							))}
						</div>
					)}

					{/* Tags */}
					{current.tags.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{current.tags.map(tag => (
								<span key={tag} className="text-[10px] px-2 py-0.5 bg-card border border-border rounded text-muted-foreground">
									{tag}
								</span>
							))}
						</div>
					)}

					{/* Last comment preview */}
					{current.lastMessagePreview && (
						<div className="bg-muted/50 border border-border rounded-lg p-3 flex gap-2">
							<IconMessage size={14} className="text-muted-foreground shrink-0 mt-0.5" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
									<span className="font-semibold">{current.lastMessagePreview.agentName}</span>
									<span>{formatTime(current.lastMessagePreview.timestamp)}</span>
								</div>
								<p className="text-xs text-foreground line-clamp-2">
									{current.lastMessagePreview.content}
								</p>
							</div>
						</div>
					)}

					{/* Inline reply */}
					{showReply && (
						<div className="flex flex-col gap-2">
							<textarea
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								placeholder="Type your reply..."
								autoFocus
								className="w-full min-h-[80px] p-3 text-sm border border-border rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] resize-none"
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										handleReplyAndResume();
									}
								}}
							/>
						</div>
					)}
				</div>

				{/* Action bar */}
				<div className="border-t border-border px-5 py-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<button
							onClick={handleSkip}
							disabled={isProcessing}
							className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
						>
							<IconArrowRight size={14} />
							Skip
						</button>
					</div>

					<button
						onClick={handleOpenDetails}
						className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
					>
						Open Details
					</button>

					<div className="flex items-center gap-2">
						{showReply ? (
							<button
								onClick={handleReplyAndResume}
								disabled={isProcessing || !replyText.trim()}
								className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--accent-blue)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
							>
								<IconPlayerPlay size={14} />
								Reply & Resume
							</button>
						) : (
							<button
								onClick={() => setShowReply(true)}
								className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 rounded-lg transition-colors"
							>
								<IconMessage size={14} />
								Reply
							</button>
						)}
						<button
							onClick={handleApprove}
							disabled={isProcessing}
							className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--accent-green)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
						>
							<IconCheck size={14} />
							Approve
						</button>
					</div>
				</div>

				{/* Keyboard hints */}
				<div className="px-5 py-2 border-t border-border flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
					<span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">A</kbd> approve</span>
					<span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">R</kbd> reply</span>
					<span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">S</kbd> skip</span>
					<span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">&larr;&rarr;</kbd> navigate</span>
					<span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Esc</kbd> close</span>
				</div>
			</div>
		</div>
	);
};

export default TriageModal;
