import { Component, useEffect, type ReactNode } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { logManager } from '../log';
import { useGlobalization } from '../globalization';
import { Button, Panel } from './primitives';

export function Page({ id, title, description, overview = false, children }: {
  id: string; title: string; description?: string; overview?: boolean; children: ReactNode;
}) {
  useEffect(() => {
    logManager.write({ level: 'info', category: 'page', outcome: 'open', operation: id });
    return () => logManager.write({ level: 'info', category: 'page', outcome: 'close', operation: id });
  }, [id]);
  useEffect(() => { document.title = title + ' | DCPCoreX'; }, [title]);
  if (overview) return <div><h1 className="sr-only">{title}</h1>{children}</div>;
  return <article className="workspace-page">
    <header className="workspace-title">
      <h1>{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </header>
    <div className="workspace-page-body">{children}</div>
  </article>;
}

export function PageGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="workspace-group">
    <h2 className="workspace-group-title">{title}</h2>
    <div className="workspace-group-body">{children}</div>
  </section>;
}

export function LoadingRegion({ loading, children }: { loading: boolean; children: ReactNode }) {
  const { t } = useGlobalization();
  return <div className="workspace-loading-region">
    <div className="grid min-w-0 gap-2" aria-busy={loading} inert={loading}>{children}</div>
    {loading && <div className="workspace-loading-overlay" role="status">
      <span><LoaderCircle aria-hidden className="size-5 text-primary motion-safe:animate-spin" />{t('Common.Loading')}</span>
    </div>}
  </div>;
}

export function StatusPanel({ kind, error, retry }: {
  kind: 'loading' | 'error' | 'empty' | 'denied' | 'missing'; error?: unknown; retry?: () => void;
}) {
  const { t, error: message } = useGlobalization();
  const labels = {
    loading: t('Common.Loading'), error: error ? message(error) : t('Common.Error'),
    empty: t('Common.Empty'), denied: t('Common.Denied'), missing: t('Common.Missing'),
  };
  return <Panel className="flex min-h-28 flex-wrap items-center gap-3 p-5">
    {kind === 'loading' && <LoaderCircle className="size-5 animate-spin text-primary" />}
    {kind === 'error' && <AlertTriangle className="size-5 text-destructive" />}
    <span role={['error', 'denied', 'missing'].includes(kind) ? 'alert' : 'status'}>{labels[kind]}</span>
    {retry && <Button onClick={retry}>{t('Common.Retry')}</Button>}
  </Panel>;
}

function BoundaryFallback({ retry }: { retry: () => void }) {
  const { t } = useGlobalization();
  return <div className="mx-auto max-w-2xl p-5">
    <StatusPanel kind="error" retry={retry} />
    <a className="mt-4 inline-block text-primary underline" href="/index">{t('Common.Home')}</a>
  </div>;
}

export class ApplicationErrorBoundary extends Component<
  { children: ReactNode; identity?: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    logManager.write({ level: 'error', category: 'render', outcome: 'failure', operation: this.props.identity ?? 'application' });
  }
  render() {
    return this.state.failed ? <BoundaryFallback retry={() => this.setState({ failed: false })} /> : this.props.children;
  }
}

export function DefinitionList({ items, compact, className = '' }: {
  items: Array<[string, ReactNode]>; compact?: boolean; className?: string;
}) {
  const layout = compact ? 'workspace-fields grid gap-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2';
  return <dl className={className ? layout + ' ' + className : layout}>
    {items.map(([label, value]) => <div key={label} className={compact ? 'workspace-readonly' : 'min-w-0'}>
      <dt className={compact ? undefined : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd className={compact ? undefined : 'mt-0.5 break-words font-medium'}>{value ?? '–'}</dd>
    </div>)}
  </dl>;
}
