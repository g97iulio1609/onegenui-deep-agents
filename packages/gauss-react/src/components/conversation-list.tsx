import React, { useCallback, useMemo, useState } from "react";
import type { GaussTheme } from "../theme.js";
import { themeToVars } from "../theme.js";

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  agentName?: string;
}

export interface ConversationListProps {
  /** List of conversations to display */
  conversations: Conversation[];
  /** Currently selected conversation ID */
  selectedId?: string;
  /** Callback when a conversation is selected */
  onSelect?: (id: string) => void;
  /** Callback when a conversation is deleted */
  onDelete?: (id: string) => void;
  /** Callback when creating a new conversation */
  onCreate?: () => void;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Custom class name */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Theme override */
  theme?: GaussTheme;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return days === 1 ? "Yesterday" : `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/** Scrollable list of conversations with search, create, and delete. */
export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  searchPlaceholder = "Search conversations...",
  className,
  emptyMessage = "No conversations found",
  theme,
}: ConversationListProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const vars = theme ? themeToVars(theme) : {};

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [conversations, search]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect?.(id);
    },
    [onSelect],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDelete?.(id);
    },
    [onDelete],
  );

  return (
    <div
      className={className}
      data-testid="gauss-conversation-list"
      style={{ ...containerStyle, ...vars } as React.CSSProperties}
    >
      <div style={headerStyle}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          data-testid="gauss-conversation-search"
          style={searchInputStyle}
        />
        {onCreate && (
          <button
            onClick={onCreate}
            data-testid="gauss-conversation-new-btn"
            style={newButtonStyle}
            type="button"
          >
            + New
          </button>
        )}
      </div>

      <div style={listStyle}>
        {filtered.length === 0 ? (
          <div style={emptyStyle}>{emptyMessage}</div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId;
            const isHovered = conv.id === hoveredId;
            return (
              <div
                key={conv.id}
                data-testid="gauss-conversation-item"
                onClick={() => handleSelect(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  ...itemStyle,
                  backgroundColor: isSelected
                    ? "var(--gauss-primary, #6366f1)"
                    : isHovered
                      ? "#f3f4f6"
                      : "transparent",
                  color: isSelected ? "#fff" : "var(--gauss-text, #111827)",
                }}
              >
                <div style={itemContentStyle}>
                  <div style={itemTitleRowStyle}>
                    <span style={itemTitleStyle}>{conv.title}</span>
                    <span
                      style={{
                        ...itemTimeStyle,
                        color: isSelected ? "rgba(255,255,255,0.7)" : "#9ca3af",
                      }}
                    >
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <div
                      style={{
                        ...itemPreviewStyle,
                        color: isSelected ? "rgba(255,255,255,0.8)" : "#6b7280",
                      }}
                    >
                      {conv.lastMessage.length > 60
                        ? conv.lastMessage.slice(0, 60) + "…"
                        : conv.lastMessage}
                    </div>
                  )}
                  {conv.agentName && (
                    <span
                      data-testid="gauss-conversation-agent-badge"
                      style={{
                        ...agentBadgeStyle,
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.2)"
                          : "#e5e7eb",
                        color: isSelected ? "#fff" : "#374151",
                      }}
                    >
                      {conv.agentName}
                    </span>
                  )}
                </div>
                {onDelete && isHovered && (
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    data-testid="gauss-conversation-delete-btn"
                    style={{
                      ...deleteBtnStyle,
                      color: isSelected ? "rgba(255,255,255,0.8)" : "#9ca3af",
                    }}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--gauss-font, system-ui, -apple-system, sans-serif)",
  backgroundColor: "var(--gauss-bg, #ffffff)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
};

const newButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "var(--gauss-primary, #6366f1)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const emptyStyle: React.CSSProperties = {
  padding: "24px 16px",
  textAlign: "center",
  color: "#9ca3af",
  fontSize: "14px",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  cursor: "pointer",
  borderBottom: "1px solid #f3f4f6",
  transition: "background-color 0.15s",
};

const itemContentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const itemTitleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
};

const itemTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "14px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemTimeStyle: React.CSSProperties = {
  fontSize: "12px",
  flexShrink: 0,
};

const itemPreviewStyle: React.CSSProperties = {
  fontSize: "13px",
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const agentBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "10px",
  marginTop: "4px",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  padding: "4px 8px",
  borderRadius: "4px",
  flexShrink: 0,
  marginLeft: "8px",
};
