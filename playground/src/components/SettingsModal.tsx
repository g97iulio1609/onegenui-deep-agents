import { useState, useEffect } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/config")
        .then((r) => r.json())
        .then((data) => setStatus(data))
        .catch(() => {});
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (openaiKey) body.openaiKey = openaiKey;
      if (anthropicKey) body.anthropicKey = anthropicKey;
      if (googleKey) body.googleKey = googleKey;
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const updated = await fetch("/api/config").then((r) => r.json());
      setStatus(updated);
      setOpenaiKey("");
      setAnthropicKey("");
      setGoogleKey("");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "var(--pg-overlay-bg)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--pg-surface)", borderRadius: 12, padding: 24, width: 480,
          border: "1px solid var(--pg-border)", color: "var(--pg-text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>⚙️ API Settings</h2>
        <p style={{ color: "var(--pg-text-muted)", fontSize: 14, margin: "0 0 20px" }}>
          Enter your API keys to enable providers. Keys are stored in memory only.
        </p>

        {[
          { label: "OpenAI", key: "hasOpenai", value: openaiKey, set: setOpenaiKey, placeholder: "sk-..." },
          { label: "Anthropic", key: "hasAnthropic", value: anthropicKey, set: setAnthropicKey, placeholder: "sk-ant-..." },
          { label: "Google", key: "hasGoogle", value: googleKey, set: setGoogleKey, placeholder: "AIza..." },
        ].map(({ label, key, value, set, placeholder }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span>{label}</span>
              <span style={{
                fontSize: 12, padding: "2px 8px", borderRadius: 99,
                background: status[key] ? "var(--pg-status-ok)" : "var(--pg-status-err)",
                color: "var(--pg-status-text)",
              }}>
                {status[key] ? "✓ configured" : "missing"}
              </span>
            </div>
            <input
              type="password"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--pg-border)", background: "var(--pg-bg)",
                color: "var(--pg-text)", fontSize: 14, boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--pg-border)",
            background: "transparent", color: "var(--pg-text)", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "var(--pg-accent)", color: "var(--pg-user-msg-color)", cursor: "pointer", fontWeight: 600,
          }}>{saving ? "Saving..." : "Save Keys"}</button>
        </div>
      </div>
    </div>
  );
}
