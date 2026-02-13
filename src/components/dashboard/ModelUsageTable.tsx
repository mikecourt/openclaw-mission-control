interface ModelUsageTableProps {
	data: Array<{ model: string; cost: number; tokens: number; calls: number }>;
}

export default function ModelUsageTable({ data }: ModelUsageTableProps) {
	if (!data || data.length === 0) {
		return (
			<div style={{ padding: 20, textAlign: "center", color: "var(--mc-text-muted)", fontSize: 13 }}>
				No usage data yet
			</div>
		);
	}

	return (
		<div style={{ overflowY: "auto", maxHeight: 300 }}>
			<table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
				<thead>
					<tr style={{ borderBottom: "1px solid var(--mc-border)" }}>
						<th style={{ textAlign: "left", padding: "8px 12px", color: "var(--mc-text-muted)", fontWeight: 600 }}>
							Model
						</th>
						<th style={{ textAlign: "right", padding: "8px 12px", color: "var(--mc-text-muted)", fontWeight: 600 }}>
							Cost
						</th>
						<th style={{ textAlign: "right", padding: "8px 12px", color: "var(--mc-text-muted)", fontWeight: 600 }}>
							Tokens
						</th>
						<th style={{ textAlign: "right", padding: "8px 12px", color: "var(--mc-text-muted)", fontWeight: 600 }}>
							Calls
						</th>
					</tr>
				</thead>
				<tbody>
					{data.map((row) => (
						<tr key={row.model} style={{ borderBottom: "1px solid var(--mc-border)" }}>
							<td style={{ padding: "8px 12px", color: "var(--mc-text-primary)" }}>
								{row.model}
							</td>
							<td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: "var(--mc-text-primary)" }}>
								${row.cost.toFixed(2)}
							</td>
							<td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: "var(--mc-text-secondary)" }}>
								{(row.tokens / 1000).toFixed(1)}K
							</td>
							<td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: "var(--mc-text-secondary)" }}>
								{row.calls}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
