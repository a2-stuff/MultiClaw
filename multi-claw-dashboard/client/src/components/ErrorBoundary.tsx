import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** If true, renders a compact inline error instead of full-page */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.inline) {
      return (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 m-4">
          <h3 className="text-lg font-bold text-red-400 mb-2">This section encountered an error</h3>
          <div className="bg-gray-800 rounded-lg p-3 mb-3 overflow-auto max-h-32">
            <p className="text-red-300 text-sm font-mono break-all">
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
          >
            Try Again
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-900 border border-red-800 rounded-xl p-8 max-w-lg w-full">
          <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-gray-400 text-sm mb-4">
            The application encountered an unexpected error.
          </p>
          <div className="bg-gray-800 rounded-lg p-4 mb-4 overflow-auto max-h-48">
            <p className="text-red-300 text-sm font-mono break-all">
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }
}
