import { useCallback, useState } from 'react';
import { ListOrdered, Rows3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { exportTable } from '@/shared/export';
import { DataTable, ListPage, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { Button, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { loadCacheValue, loadRuntimeCatalog, runtimeCommand, type RuntimeKind, type RuntimeResource } from './runtime-data-api';
import { RuntimeItems } from './runtime-data-items';

const pages = { cache: 'WebCacheItemList', queues: 'WebQueueList', tables: 'WebTableList' };
const titles = { cache: 'Cache', queues: 'Queues', tables: 'Tables' };

export function CacheItemList() { return <RuntimeDataList kind="cache" />; }
export function QueueList() { return <RuntimeDataList kind="queues" />; }
export function RuntimeTableList() { return <RuntimeDataList kind="tables" />; }

function RuntimeDataList({ kind }: { kind: RuntimeKind }) {
  const { state, http } = useSession();
  const { canPage, canAction } = useWorkspace();
  const { t, error, number } = useGlobalization();
  const navigate = useNavigate();
  const confirm = useDialogManager();
  const [type, setType] = useState(0);
  const [selection, setSelection] = useState<string>();
  const [opened, setOpened] = useState<RuntimeResource>();
  const [moving, setMoving] = useState<RuntimeResource>();
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const page = pages[kind];
  const action = (key: string) => canAction(page, key);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Runtime.' + titles[kind]);
  const cache = kind === 'cache';
  const queue = kind === 'queues';
  const relatedPage = cache ? 'WebCacheItemDetail' : queue ? 'WebQueueItemList' : 'WebTableRowList';
  const openAction = cache ? 'WebViewCacheItem' : queue ? 'WebListQueueItems' : 'WebListTableRows';
  const deleteAction = cache ? 'WebDeleteCacheItem' : queue ? 'WebDeleteQueue' : 'WebDeleteTable';
  const clearAction = cache ? 'WebClearCache' : queue ? 'WebClearQueue' : 'WebClearTable';
  const load = useCallback((signal: AbortSignal) => common
    ? loadRuntimeCatalog(http, kind, type, signal) : Promise.resolve({ rows: [], canClear: false }), [common, http, kind, type]);
  const result = useResource(load);
  const rows = result.state === 'ready' ? result.data.rows : [];
  const row = rows.find(item => item.name === selection);
  const columns: Column<RuntimeResource>[] = [{ key: 'name', title: core(cache ? 'Key' : 'Name'), render: item => item.name }];
  if (!cache) columns.push({ key: 'count', title: core('Count'), render: item => number.format(item.count ?? 0), numeric: true });

  async function mutate(command: 'clear' | 'delete') {
    if (!common || !action(command === 'clear' ? clearAction : deleteAction) || (!(cache && command === 'clear') && !row?.canAccess))
      return;
    const label = core(command === 'clear' ? 'Clear' : 'Delete');
    if (!await confirm({ message: command === 'clear' ? t('Runtime.ClearConfirm', { name: cache ? title : row?.name ?? '' })
      : t('Common.DeleteConfirm', { name: row?.name ?? '' }), accept: label, reject: core('Cancel') })) return;
    try {
      await runtimeCommand(http, kind + (cache ? '/' : '/resource/') + command,
        cache ? command === 'delete' && row ? { key: row.name } : undefined : row ? { name: row.name } : undefined);
      setSelection(undefined);
      result.refresh();
      toast.success(t(command === 'delete' ? 'Common.Deleted' : 'Runtime.Cleared'));
    } catch (failure) { toast.error(error(failure, true)); }
  }

  return <Page id={page} title={title}>
    {common ? <ListPage resultsTitle={title}
      tools={<Toolbar operation={page} actions={[
        { key: openAction, label: core(cache ? 'View' : queue ? 'Items' : 'Rows'),
          icon: cache ? <WorkspaceIcon name="view" /> : queue ? <ListOrdered aria-hidden="true" /> : <Rows3 aria-hidden="true" />,
          allowed: action(openAction) && canPage(relatedPage), enabled: row?.canAccess === true,
          run: () => { if (row?.canAccess) setOpened(row); } },
        { key: 'WebMoveQueue', label: core('Move'), allowed: queue && action('WebMoveQueue') && canPage('WebQueueMove'),
          enabled: row?.canAccess === true, run: () => { if (row?.canAccess) setMoving(row); } },
        { key: deleteAction, label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: action(deleteAction),
          enabled: row?.canAccess === true, run: () => mutate('delete') },
        { key: clearAction, label: core('Clear'), allowed: action(clearAction),
          enabled: cache ? result.state === 'ready' && result.data.canClear : row?.canAccess === true, run: () => mutate('clear') },
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />, run: result.refresh },
        { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, kind, [columns.map(column => column.title),
                ...rows.map(item => cache ? [item.name] : [item.name, item.count ?? 0])]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={queue && <SelectField label={core('Type')} value={type} onChange={value => {
        setSelection(undefined);
        setType(Number(value));
      }} options={[{ value: 0, label: core('All') }, { value: 1, label: t('Runtime.Standard') },
        { value: 2, label: t('Runtime.Failed') }]} />}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <DataTable label={title} rows={rows} columns={columns} rowId={item => item.name} selected={selection}
            onSelect={item => setSelection(item.name)} resizable />}
      </LoadingRegion>
    </ListPage> : <StatusPanel kind="denied" />}
    {opened && (kind === 'cache'
      ? <CacheValue name={opened.name} onClose={() => setOpened(undefined)} />
      : <RuntimeItems kind={kind} name={opened.name} onClose={() => setOpened(undefined)} onChanged={result.refresh} />)}
    {moving && <MoveQueue name={moving.name} choices={rows.filter(item => item.canAccess && item.name !== moving.name)}
      onClose={() => setMoving(undefined)} onMoved={() => { setMoving(undefined); result.refresh(); }} />}
  </Page>;
}

function CacheValue({ name, onClose }: { name: string; onClose: () => void }) {
  const { http } = useSession();
  const load = useCallback((signal: AbortSignal) => loadCacheValue(http, name, signal), [http, name]);
  const result = useResource(load);
  return <Modal workspace title={name} onClose={onClose}>
    {result.state === 'ready' ? <pre className="max-w-full whitespace-pre-wrap break-all">{JSON.stringify(result.data.value, null, 2)}</pre>
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function MoveQueue({ name, choices, onMoved, onClose }: {
  name: string; choices: RuntimeResource[]; onMoved: () => void; onClose: () => void;
}) {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const core = (key: string) => t(key, undefined, 'Core');
  async function submit() {
    if (busy || !choices.some(item => item.name === destination)) return;
    setBusy(true);
    try {
      await runtimeCommand(http, 'queues/move', undefined, { sourceQueueName: name, destinationQueueName: destination });
      toast.success(t('Runtime.Moved'));
      onMoved();
    } catch (failure) { toast.error(error(failure, true)); }
    finally { setBusy(false); }
  }
  return <Modal workspace title={core('Move') + ' - ' + name} onClose={() => { if (!busy) onClose(); }}>
    <form className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <SelectField label={t('Runtime.Destination')} value={destination} disabled={busy} onChange={setDestination}
        options={[{ value: '', label: '–' }, ...choices.map(item => ({ value: item.name, label: item.name }))]} />
      <Button type="submit" disabled={busy || !destination}>{core('Move')}</Button>
    </form>
  </Modal>;
}
