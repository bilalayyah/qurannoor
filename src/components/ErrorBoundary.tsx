import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Changing this value resets the boundary (e.g. on navigation). */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors so one crashing component cannot blank the whole app.
 * Shows a friendly fallback with a reload action instead of a blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the failure visible in the console for debugging; the UI stays friendly.
    console.error('QuranNoor render error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
          <h1
            className="font-ui text-xl font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Something went wrong
          </h1>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            This page could not be loaded. Please reload the page — your bookmarks and reading
            progress are saved on your device and will not be lost.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
