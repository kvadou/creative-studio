import { Component, type ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stc-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-card p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stc-pink/10 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-8 h-8 text-stc-pink" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-neutral-500 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary px-6 py-2.5 min-h-[44px]"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
