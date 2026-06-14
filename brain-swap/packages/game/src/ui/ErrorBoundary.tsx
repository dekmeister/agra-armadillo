// A top-level error boundary so a runtime error renders a readable panel instead of a
// black screen (the app background is near-black, so an unmounted tree looks like nothing).
import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the console useful in dev.
    console.error("Brain Swap crashed:", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ padding: 24, color: "#c2cdb0", fontFamily: "IBM Plex Mono, monospace", overflow: "auto", height: "100%" }}>
        <h2 style={{ color: "#e0483a" }}>Console fault</h2>
        <pre style={{ whiteSpace: "pre-wrap", color: "#f2c200" }}>{error.message}</pre>
        <pre style={{ whiteSpace: "pre-wrap", color: "#7d876b", fontSize: 11 }}>{error.stack}</pre>
        <button
          style={{ marginTop: 12, padding: "6px 12px", background: "#161b13", color: "#c2cdb0", border: "1px solid #3c4632", cursor: "pointer" }}
          onClick={() => this.setState({ error: null })}
        >
          Dismiss
        </button>
      </div>
    );
  }
}
