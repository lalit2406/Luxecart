import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Admin Panel Error Boundary
 * Prevents isolated admin component rendering crashes from blanking the entire admin portal.
 */
export class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AdminErrorBoundary] Caught unhandled rendering exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E7DED5] rounded-3xl p-8 shadow-xs text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#2A211B]">
                Admin Component Error
              </h2>
              <p className="text-xs text-[#6F6963] mt-2">
                An unexpected rendering issue occurred in this section. Other administrative modules remain active.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-[#F7F3EE] rounded-xl text-left border border-[#E7DED5]">
                <p className="text-[11px] font-mono text-[#2A211B] break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
