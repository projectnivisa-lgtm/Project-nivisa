import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Label shown in the fallback, e.g. "Orders" — falls back to "This page". */
  section?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/lifecycle errors in whatever it wraps so one broken page
 * can't blank out the whole dashboard. Sidebar/Header live outside this
 * boundary in App.tsx, so staff can always navigate away to a working page.
 *
 * Never render `error.message` here — it can contain raw values from
 * whatever broke (API payloads, stack frames), which is exactly the kind
 * of internal detail we don't want on screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.section ?? 'unknown section', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="a-note a-note--framed"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center',
            padding: '48px 24px',
          }}
        >
          <AlertTriangle size={32} style={{ color: 'var(--accent-red, #d33)' }} />
          <div>
            <strong>{this.props.section ?? 'This page'} could not be displayed.</strong>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
              Something went wrong loading this section. The rest of the dashboard is unaffected —
              use the sidebar to continue working, or reload this page to try again.
            </p>
          </div>
          <button
            type="button"
            className="a-btn a-btn--primary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
