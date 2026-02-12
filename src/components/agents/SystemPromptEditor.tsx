import { useState, useEffect } from "react";

interface PromptHistoryEntry {
  prompt: string;
  savedAt: number;
}

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  promptHistory?: PromptHistoryEntry[];
}

export default function SystemPromptEditor({
  value,
  onChange,
  onSave,
  onReset,
  isSaving = false,
  promptHistory,
}: SystemPromptEditorProps) {
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);
  const [originalValue] = useState(value);
  const hasChanges = value !== originalValue;

  // Reset viewingHistoryIndex when value changes externally
  useEffect(() => {
    setViewingHistoryIndex(null);
  }, []);

  const handleHistorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = e.target.value;
    if (idx === "") {
      setViewingHistoryIndex(null);
      return;
    }
    const index = Number(idx);
    setViewingHistoryIndex(index);
    if (promptHistory && promptHistory[index]) {
      onChange(promptHistory[index].prompt);
    }
  };

  return (
    <div>
      {/* History dropdown */}
      {promptHistory && promptHistory.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label
            htmlFor="prompt-history"
            style={{ fontSize: 11, color: "var(--mc-text-muted)", marginRight: 8 }}
          >
            Version History:
          </label>
          <select
            id="prompt-history"
            value={viewingHistoryIndex !== null ? String(viewingHistoryIndex) : ""}
            onChange={handleHistorySelect}
            style={{
              background: "var(--mc-bg-primary)",
              border: "1px solid var(--mc-border)",
              borderRadius: 4,
              color: "var(--mc-text-primary)",
              fontSize: 12,
              padding: "4px 8px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value="">Current</option>
            {[...promptHistory].reverse().map((entry, revIdx) => {
              const realIdx = promptHistory.length - 1 - revIdx;
              return (
                <option key={realIdx} value={realIdx}>
                  {new Date(entry.savedAt).toLocaleString()}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Editor textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: 180,
          padding: 12,
          background: "var(--mc-bg-primary)",
          border: "1px solid var(--mc-border)",
          borderRadius: 6,
          color: "var(--mc-text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onReset}
          disabled={!hasChanges}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: "transparent",
            border: "1px solid var(--mc-border)",
            borderRadius: 6,
            color: hasChanges ? "var(--mc-text-secondary)" : "var(--mc-text-muted)",
            cursor: hasChanges ? "pointer" : "not-allowed",
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          Reset
        </button>
        <button
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: hasChanges ? "var(--mc-accent, #3b82f6)" : "var(--mc-border)",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            cursor: hasChanges && !isSaving ? "pointer" : "not-allowed",
            opacity: hasChanges && !isSaving ? 1 : 0.5,
            fontWeight: 500,
          }}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
