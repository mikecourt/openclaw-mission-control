import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import { formatCost } from "../lib/utils";

export default function SettingsPage() {
	const usageSummary = useQuery(api.queries.getUsageSummary, { tenantId: DEFAULT_TENANT_ID });
	const allSettings = useQuery(api.systemSettings.getAllSettings, { tenantId: DEFAULT_TENANT_ID });
	const setSetting = useMutation(api.systemSettings.setSetting);
	const purgeOldTasks = useMutation(api.systemSettings.purgeOldTasks);

	const [opusBudget, setOpusBudget] = useState(45);
	const [retentionDays, setRetentionDays] = useState(30);
	const [saving, setSaving] = useState(false);
	const [purging, setPurging] = useState(false);
	const [purgeResult, setPurgeResult] = useState<string | null>(null);

	// Initialize from settings
	const opusBudgetSetting = allSettings?.find((s) => s.key === "opusBudget");
	const retentionSetting = allSettings?.find((s) => s.key === "retentionDays");

	const handleSaveSettings = async () => {
		setSaving(true);
		try {
			await setSetting({ tenantId: DEFAULT_TENANT_ID, key: "opusBudget", value: opusBudget });
			await setSetting({ tenantId: DEFAULT_TENANT_ID, key: "retentionDays", value: retentionDays });
		} finally {
			setSaving(false);
		}
	};

	const handlePurge = async () => {
		setPurging(true);
		setPurgeResult(null);
		try {
			const result = await purgeOldTasks({ tenantId: DEFAULT_TENANT_ID, olderThanDays: retentionDays });
			setPurgeResult(`Purged ${result.purged} old tasks`);
		} finally {
			setPurging(false);
		}
	};

	const handleExport = () => {
		const data = { usageSummary, settings: allSettings, exportedAt: new Date().toISOString() };
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `mission-control-export-${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div>
			<div className="page-header">
				<h1>Settings</h1>
			</div>

			{/* System parameters */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label" style={{ marginBottom: 12 }}>System Parameters</div>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
					<div>
						<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
							Opus Daily Budget ($)
						</label>
						<input
							type="number"
							value={opusBudget}
							onChange={(e) => setOpusBudget(Number(e.target.value))}
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
							Task Retention (days)
						</label>
						<input
							type="number"
							value={retentionDays}
							onChange={(e) => setRetentionDays(Number(e.target.value))}
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
					<div style={{ display: "flex", alignItems: "flex-end" }}>
						<button
							className="btn-primary"
							type="button"
							onClick={handleSaveSettings}
							disabled={saving}
							style={{ width: "100%" }}
						>
							{saving ? "Saving..." : "Save Settings"}
						</button>
					</div>
				</div>
				{opusBudgetSetting && (
					<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginTop: 8 }}>
						Last saved: {new Date(opusBudgetSetting.updatedAt).toLocaleString()}
					</div>
				)}
			</div>

			{/* API Status */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label" style={{ marginBottom: 12 }}>API Providers</div>
				<table className="data-table">
					<thead>
						<tr>
							<th>Provider</th>
							<th>Status</th>
							<th>Plan</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Anthropic (Claude Max)</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>$200/mo</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>Consumer plan (OAuth)</td>
						</tr>
						<tr>
							<td>Convex</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>Free tier</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>Dev deployment</td>
						</tr>
						<tr>
							<td>GoHighLevel</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>Agency</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>CRM + automation</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Current settings */}
			{allSettings && allSettings.length > 0 && (
				<div className="metric-card" style={{ marginBottom: 16 }}>
					<div className="metric-label" style={{ marginBottom: 12 }}>Stored Settings</div>
					<table className="data-table">
						<thead>
							<tr>
								<th>Key</th>
								<th>Value</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{allSettings.map((s) => (
								<tr key={s._id}>
									<td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.key}</td>
									<td style={{ fontSize: 12 }}>{JSON.stringify(s.value)}</td>
									<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>
										{new Date(s.updatedAt).toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Data Management */}
			<div className="metric-card">
				<div className="metric-label" style={{ marginBottom: 12 }}>Data Management</div>
				{usageSummary && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
						<MetricCard label="Total Cost" value={formatCost(usageSummary.totalCost)} />
						<MetricCard label="Usage Records" value={usageSummary.recordCount} />
						<MetricCard label="MTD Cost" value={formatCost(usageSummary.mtdCost)} />
					</div>
				)}
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<button
						className="btn-secondary"
						type="button"
						onClick={handlePurge}
						disabled={purging}
					>
						{purging ? "Purging..." : `Purge Tasks > ${retentionDays} days`}
					</button>
					<button className="btn-secondary" type="button" onClick={handleExport}>
						Export Data
					</button>
					{purgeResult && (
						<span style={{ fontSize: 12, color: "var(--mc-status-ok)" }}>{purgeResult}</span>
					)}
				</div>
			</div>
		</div>
	);
}
