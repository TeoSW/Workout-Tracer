import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { DataContext } from '../data/context';
import type { AppUpdate } from '../pwa/useAppUpdate';
import { CrashScreen } from './CrashScreen';

type Props = { ctx: DataContext; update: AppUpdate; children: ReactNode };

/** Sits above everything, so a crash in any screen can't trap anyone's logs. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    const { ctx, update, children } = this.props;
    return this.state.failed ? <CrashScreen ctx={ctx} update={update} /> : children;
  }
}
