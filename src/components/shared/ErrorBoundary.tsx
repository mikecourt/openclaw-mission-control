import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;

			const isConvexMissing = this.state.error?.message?.includes("Could not find public function");

			return (
				<div style={{ padding: 40, textAlign: "center" }}>
					<div style={{ fontSize: 16, fontWeight: 600, color: "var(--mc-text-primary, #e4e4ef)", marginBottom: 8 }}>
						{isConvexMissing ? "Backend not deployed" : "Something went wrong"}
					</div>
					<div style={{ fontSize: 13, color: "var(--mc-text-muted, #55556a)", maxWidth: 500, margin: "0 auto" }}>
						{isConvexMissing
							? "This page requires new Convex functions that haven't been deployed yet. Run npx convex dev on the OpenClaw machine to deploy."
							: this.state.error?.message || "An unexpected error occurred."}
					</div>
					<button
						type="button"
						onClick={() => this.setState({ hasError: false, error: null })}
						style={{
							marginTop: 16,
							padding: "8px 16px",
							fontSize: 13,
							background: "var(--mc-bg-card, #1a1a26)",
							border: "1px solid var(--mc-border, #2a2a3a)",
							borderRadius: 6,
							color: "var(--mc-text-primary, #e4e4ef)",
							cursor: "pointer",
						}}
					>
						Retry
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
