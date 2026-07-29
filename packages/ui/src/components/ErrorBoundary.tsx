"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown as the boundary's own label, e.g. a panel's title. */
  title?: string;
  /** Called once, when a child throws — for telemetry hooks later; never
   * required for the boundary itself to degrade correctly. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates a crash to whatever's inside it (docs/PRD.md §9's "an error
 * boundary per panel so one bad panel cannot end a session") — React only
 * offers this via a class component's `getDerivedStateFromError`/
 * `componentDidCatch`, there's no hook equivalent. "Retry" just clears the
 * caught error and re-renders `children`; if the same input still throws
 * (a genuinely broken panel, not a transient issue), it'll re-catch
 * immediately rather than loop, which is the correct behavior — retry is
 * for "this panel choked on a step that's since scrubbed past," not a
 * silent infinite-retry mechanism.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full min-h-0 flex-col items-center justify-center gap-2 border border-mutate bg-panel p-4 text-center"
      >
        <span className="font-body text-[13px] font-semibold text-mutate">
          {this.props.title ? `${this.props.title} ran into a problem` : "This panel ran into a problem"}
        </span>
        <span className="max-w-xs font-body text-[12px] text-ink-soft">{error.message}</span>
        <Button variant="secondary" size="sm" onClick={this.handleRetry}>
          Retry
        </Button>
      </div>
    );
  }
}
