import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Fallback UI shown when an error is caught. */
  fallback?: ReactNode;
  /** Label for the error report (helps identify which section crashed). */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? ` — ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-warn/30 bg-warn/10 p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h3 className="text-lg font-extrabold text-ink">Something went wrong</h3>
          <p className="text-[13px] text-mut">
            {this.props.section ? `The ${this.props.section} section` : "This section"} encountered an error and couldn't render.
          </p>
          <p className="text-[12px] text-fnt/50 font-mono">{this.state.error?.message}</p>
          <button
            onClick={this.reset}
            className="rounded-xl border border-acc1/40 bg-acc1/15 px-5 py-2 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
