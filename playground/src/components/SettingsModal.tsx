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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e1e2e", borderRadius: 12, padding: 24, width: 480,
          border: "1px solid #313244", color: "#cdd6f4",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>⚙️ API Settings</h2>
        <p style={{ color: "#a6adc8", fontSize: 14, margin: "0 0 20px" }}>
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
                background: status[key] ? "#a6e3a1" : "#f38ba8",
                color: "#1e1e2e",
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
                border: "1px solid #313244", background: "#11111b",
                color: "#cdd6f4", fontSize: 14, boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #313244",
            background: "transparent", color: "#cdd6f4", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "#89b4fa", color: "#1e1e2e", cursor: "pointer", fontWeight: 600,
          }}>{saving ? "Saving..." : "Save Keys"}</button>
        </div>
      </div>
    </div>
  );
}
