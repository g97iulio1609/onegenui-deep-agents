import React from "react";

export interface ErrorBoundaryProps {
  /** Fallback UI shown when an error is caught. */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Callback when an error is caught. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Child components to wrap. */
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary for Gauss chat components.
 *
 * Catches rendering errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 *
 * @example
 * ```tsx
 * import { GaussErrorBoundary, GaussChat } from "@gauss-ai/react";
 *
 * function App() {
 *   return (
 *     <GaussErrorBoundary
 *       fallback={(error, reset) => (
 *         <div>
 *           <p>Something went wrong: {error.message}</p>
 *           <button onClick={reset}>Try again</button>
 *         </div>
 *       )}
 *     >
 *       <GaussChat api="/api/chat" />
 *     </GaussErrorBoundary>
 *   );
 * }
 * ```
 */
export class GaussErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;

      if (typeof fallback === "function") {
        return fallback(this.state.error, this.reset);
      }

      if (fallback) {
        return fallback;
      }

      return (
        <div
          data-testid="gauss-error-boundary"
          style={{
            padding: "16px",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Something went wrong</p>
          <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#b91c1c" }}>
            {this.state.error.message}
          </p>
          <button
            onClick={this.reset}
            type="button"
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #fca5a5",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
