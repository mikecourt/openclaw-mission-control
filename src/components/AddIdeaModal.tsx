import React, { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";

const AREA_OPTIONS = [
	{ value: "", label: "None" },
	{ value: "chem-dry", label: "Chem-Dry" },
	{ value: "automagic", label: "Automagic" },
	{ value: "personal", label: "Personal" },
	{ value: "infrastructure", label: "Infrastructure" },
] as const;

const COLOR_SWATCHES = [
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#06b6d4",
	"#64748b",
];

type AddIdeaModalProps = {
	onClose: () => void;
};

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ onClose }) => {
	const createProject = useMutation(api.projects.create);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [area, setArea] = useState("");
	const [borderColor, setBorderColor] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!name.trim()) return;
			setSubmitting(true);

			try {
				await createProject({
					name: name.trim(),
					description: description.trim() || name.trim(),
					status: "idea",
					area: area || undefined,
					borderColor: borderColor || undefined,
					tenantId: DEFAULT_TENANT_ID,
				});
				onClose();
			} catch {
				setSubmitting(false);
			}
		},
		[name, description, area, borderColor, createProject, onClose],
	);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			onClick={onClose}
			aria-hidden="true"
		>
			<div className="absolute inset-0 bg-black/40" />
			<div
				className="relative bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-border">
					<h2 className="text-sm font-bold tracking-wide text-foreground">
						New Idea
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
						aria-label="Close modal"
					>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
					<div>
						<label className="block text-[11px] font-semibold text-muted-foreground tracking-wide mb-1.5">
							NAME
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
							placeholder="What's the idea?"
							required
							autoFocus
						/>
					</div>

					<div>
						<label className="block text-[11px] font-semibold text-muted-foreground tracking-wide mb-1.5">
							DESCRIPTION
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent resize-none"
							placeholder="Describe the idea..."
							rows={3}
						/>
					</div>

					<div>
						<label className="block text-[11px] font-semibold text-muted-foreground tracking-wide mb-1.5">
							AREA
						</label>
						<select
							value={area}
							onChange={(e) => setArea(e.target.value)}
							className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
						>
							{AREA_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-[11px] font-semibold text-muted-foreground tracking-wide mb-1.5">
							COLOR
						</label>
						<div className="flex items-center gap-2">
							{COLOR_SWATCHES.map((color) => (
								<button
									key={color}
									type="button"
									onClick={() => setBorderColor(borderColor === color ? "" : color)}
									className={`w-7 h-7 rounded-full border-2 transition-all ${
										borderColor === color
											? "border-foreground scale-110"
											: "border-transparent hover:scale-105"
									}`}
									style={{ backgroundColor: color }}
									aria-label={`Select color ${color}`}
								/>
							))}
							{borderColor && (
								<button
									type="button"
									onClick={() => setBorderColor("")}
									className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
								>
									Clear
								</button>
							)}
						</div>
					</div>

					<div className="flex justify-end gap-2 pt-2 border-t border-border">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={submitting || !name.trim()}
							className="px-4 py-2 text-sm font-semibold text-white bg-[var(--accent-blue)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{submitting ? "Creating..." : "Add Idea"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AddIdeaModal;
