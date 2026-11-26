import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { recordStatus, type RecordStatus } from '../contracts';
import { useGlobalization } from '../globalization';
import { useResource } from '../resource';
import { ListPage } from './data-table';
import { LoadingRegion, StatusPanel } from './page';
import { WorkspaceIcon } from './primitives';
import { RecordStatusQuery } from './record-status-query';
import { Toolbar, type ToolbarAction } from './toolbar';

export function RecordStatusResults<T>({ title, operation, load, actions, children, reloadVersion, filters, showQuery = true }: {
  title: string; operation: string;
  load: (status: RecordStatus, signal: AbortSignal) => Promise<T[]>;
  actions?: (rows: T[], status: RecordStatus) => ToolbarAction[];
  reloadVersion?: number;
  filters?: ReactNode;
  showQuery?: boolean;
  children: (rows: T[]) => ReactNode;
}) {
  const { t } = useGlobalization();
  const [status, setStatus] = useState<RecordStatus>(recordStatus.active);
  const query = useCallback((signal: AbortSignal) => load(status, signal), [load, status]);
  const result = useResource(query);
  const { refresh } = result;
  useEffect(() => { if (reloadVersion) refresh(); }, [reloadVersion, refresh]);
  const rows = result.state === 'ready' ? result.data : [];

  return <LoadingRegion loading={result.state === 'loading'}>
    <ListPage resultsTitle={title} query={showQuery && <RecordStatusQuery value={status} onChange={setStatus} onSearch={result.refresh}>
      {filters}
    </RecordStatusQuery>}
      tools={<Toolbar operation={operation} actions={[
        ...(actions?.(rows, status) ?? []),
        { key: 'refresh', label: t('Refresh', undefined, 'Core'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
      ]} />}>
      {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : children(rows)}
    </ListPage>
  </LoadingRegion>;
}
