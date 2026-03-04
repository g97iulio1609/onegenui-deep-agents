import React from "react";

export interface ChatSkeletonProps {
  /** Number of placeholder message rows. Default: 3. */
  rows?: number;
  /** Whether to show the input skeleton. Default: true. */
  showInput?: boolean;
  /** Custom styles. */
  style?: React.CSSProperties;
}

const shimmerKeyframes = `
@keyframes gauss-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const shimmerStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
  backgroundSize: "200% 100%",
  animation: "gauss-shimmer 1.5s ease-in-out infinite",
  borderRadius: "8px",
};

/**
 * Skeleton loading state for the chat interface.
 *
 * Shows placeholder rows with a shimmer animation while the chat is loading.
 *
 * @example
 * ```tsx
 * import { ChatSkeleton } from "@gauss-ai/react";
 *
 * function Chat() {
 *   if (loading) return <ChatSkeleton rows={4} />;
 *   return <GaussChat api="/api/chat" />;
 * }
 * ```
 */
export function ChatSkeleton({
  rows = 3,
  showInput = true,
  style,
}: ChatSkeletonProps): React.JSX.Element {
  return (
    <div
      data-testid="gauss-chat-skeleton"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        ...style,
      }}
    >
      <style>{shimmerKeyframes}</style>
      {Array.from({ length: rows }, (_, i) => (
        <MessageSkeleton key={i} isUser={i % 2 === 0} />
      ))}
      {showInput && (
        <div
          data-testid="gauss-input-skeleton"
          style={{ ...shimmerStyle, height: "44px", marginTop: "8px" }}
        />
      )}
    </div>
  );
}

function MessageSkeleton({ isUser }: { isUser: boolean }): React.JSX.Element {
  return (
    <div
      data-testid="gauss-message-skeleton"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: "6px",
      }}
    >
      <div
        style={{
          ...shimmerStyle,
          width: isUser ? "60%" : "75%",
          height: "16px",
        }}
      />
      <div
        style={{
          ...shimmerStyle,
          width: isUser ? "40%" : "55%",
          height: "16px",
        }}
      />
    </div>
  );
}
