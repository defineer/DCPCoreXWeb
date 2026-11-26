import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { SimpleDataView } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, ListPage, Pagination, type Column } from '@/shared/ui/data-table';
import { DefinitionList, LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, Field, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput } from '@/shared/zoned-dates';
import { eventSeverities } from './event-api';
import { getEventRecord, getEventRecordChoices, queryEventRecords, type EventRecord, type EventSearchCriteria } from './event-record-api';

const searchPage = 'WebEventObjectList';
const viewAction = 'WebViewEventObject';
const blankResult = { data: [], totalRecords: 0 };

function choiceOptions(all: string, rows: SimpleDataView[] = []) {
  return [{ value: 0, label: all }, ...rows.map(row => ({ value: row.id, label: row.name || String(row.id) }))];
}

export function EventRecordList() {
  const { http, state } = useSession();
  const { canAction, preferences } = useWorkspace();
  const { t, date, error, number, timeZone } = useGlobalization();
  const navigate = useNavigate();
  const today = localDateInput(new Date().toISOString(), timeZone);
  const [draft, setDraft] = useState<EventSearchCriteria>(() => ({ localStartDate: today, localEndDate: today }));
  const [criteria, setCriteria] = useState<EventSearchCriteria>();
  const [invalidRange, setInvalidRange] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, select] = useState<string>();
  const [openedKey, setOpenedKey] = useState<string>();
  const pageSize = Math.max(10, Math.min(60, preferences?.rowsPerPage ?? 20));
  const { rootGroupId, groupId } = draft;
  const loadChoices = useCallback((signal: AbortSignal) =>
    getEventRecordChoices(http, rootGroupId, groupId, signal), [http, rootGroupId, groupId]);
  const loadRows = useCallback((signal: AbortSignal) => criteria
    ? queryEventRecords(http, criteria, page, pageSize, signal)
    : Promise.resolve(blankResult), [criteria, http, page, pageSize]);
  const choices = useResource(loadChoices);
  const result = useResource(loadRows);
  const rows = result.state === 'ready' ? result.data.data : [];
  const currentChoices = choices.state === 'ready' ? choices.data : undefined;
  const currentRoots = currentChoices?.roots ??
    (choices.state === 'loading' ? choices.previousData?.roots : undefined);
  const core = (key: string) => t(key, undefined, 'Core');
  const all = core('All');
  const canView = canAction(searchPage, viewAction);
  const customerId = state.stage === 'authenticated' ? state.session.customerId : 0;
  const columns: Column<EventRecord>[] = [
    { key: 'key', title: core('Key'), render: row => row.eventKey },
    { key: 'date', title: core('Date'), render: row => date(row.eventDate) },
    { key: 'severity', title: core('Severity'), render: row => row.severity || '–' },
    { key: 'event', title: core('Event'), render: row => row.eventType || '–' },
    { key: 'root', title: core('MainGroup'), render: row => row.rootGroup || '–' },
    { key: 'group', title: core('Group'), render: row => row.group || '–' },
    { key: 'customer', title: core('Customer'), render: row => row.customerKey || '–' },
    { key: 'user', title: core('User'), render: row => row.sessionUserName || '–' },
  ];

  function submit() {
    const start = Date.parse(draft.localStartDate);
    const end = Date.parse(draft.localEndDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 365 * 86_400_000) {
      setInvalidRange(true);
      return;
    }
    setInvalidRange(false);
    select(undefined);
    setPage(1);
    setCriteria({ ...draft });
  }

  return <Page id="EventObjectList" title={t('Event.RecordSearch')}>
    <ListPage resultsTitle={core('EventRecords')}
      tools={<Toolbar operation="EventObjectList" actions={[
        { key: viewAction, label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canView,
          enabled: rows.some(row => row.eventKey === selected),
          run: () => { if (rows.some(row => row.eventKey === selected)) setOpenedKey(selected); } },
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />,
          enabled: Boolean(criteria) && result.state !== 'loading', run: () => { select(undefined); result.refresh(); } },
        { key: 'export', label: t('Event.ExportPage'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, 'event-records', [columns.map(column => column.title),
                ...rows.map(row => [row.eventKey, date(row.eventDate), row.severity || '', row.eventType || '',
                  row.rootGroup || '', row.group || '', row.customerKey || '', row.sessionUserName || ''])]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={<form className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={event => { event.preventDefault(); submit(); }}>
        <Field label={core('StartDate')} type="date" value={draft.localStartDate} onChange={localStartDate =>
          setDraft(current => ({ ...current, localStartDate }))} />
        <Field label={core('EndDate')} type="date" value={draft.localEndDate} onChange={localEndDate =>
          setDraft(current => ({ ...current, localEndDate }))} error={invalidRange ? t('Event.RecordDateRange') : undefined} />
        <Field label={core('Customer')} value={number.format(customerId)} onChange={() => {}} readOnly />
        <SelectField label={core('MainGroup')} value={rootGroupId ?? 0} options={choiceOptions(all, currentRoots)}
          onChange={value => setDraft(current => ({ ...current, rootGroupId: Number(value) || undefined,
            groupId: undefined, eventTypeId: undefined }))} disabled={!currentRoots} />
        <SelectField label={core('Group')} value={groupId ?? 0} options={choiceOptions(all, currentChoices?.groups)}
          onChange={value => setDraft(current => ({ ...current, groupId: Number(value) || undefined, eventTypeId: undefined }))}
          disabled={!rootGroupId || !currentChoices} />
        <SelectField label={core('Event')} value={draft.eventTypeId ?? 0} options={choiceOptions(all, currentChoices?.types)}
          onChange={value => setDraft(current => ({ ...current, eventTypeId: Number(value) || undefined }))}
          disabled={!rootGroupId || !currentChoices} />
        <SelectField label={core('Severity')} value={draft.severity ?? ''}
          options={[{ value: '', label: all }, ...eventSeverities.map(value => ({ value, label: core(value) }))]}
          onChange={severity => setDraft(current => ({ ...current, severity: severity || undefined }))} />
        <div className="self-end"><Button type="submit" variant="primary" disabled={result.state === 'loading'}>
          {core('Search')}
        </Button></div>
        {choices.state === 'error' && <div className="col-span-full">
          <StatusPanel kind="error" error={choices.error} retry={choices.refresh} />
        </div>}
      </form>}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} /> : <>
          <DataTable label={core('EventRecords')} rows={rows} columns={columns} rowId={row => row.eventKey} selected={selected}
            onSelect={row => select(row.eventKey)} resizable />
          <Pagination direct page={page} pageSize={pageSize} total={result.state === 'ready' ? result.data.totalRecords : 0}
            onPage={next => { select(undefined); setPage(next); }} />
        </>}
      </LoadingRegion>
    </ListPage>
    {canView && openedKey && <EventRecordDetail eventKey={openedKey} onClose={() => setOpenedKey(undefined)} />}
  </Page>;
}

function EventRecordDetail({ eventKey, onClose }: { eventKey: string; onClose: () => void }) {
  const { http } = useSession();
  const { t, date, number } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => getEventRecord(http, eventKey, signal), [http, eventKey]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const value = result.state === 'ready' ? result.data : undefined;
  return <Modal workspace title={core('Event') + ' ' + eventKey} onClose={onClose}>
    {value ? <PageGroup title={core('Details')}>
      <DefinitionList items={[[core('Key'), value.eventKey], [core('Date'), date(value.eventDate)],
        [core('Severity'), value.severity], [core('Event'), value.eventType], [core('MainGroup'), value.rootGroup],
        [core('Group'), value.group], [core('Customer'), value.customerKey], [core('User'), value.sessionUserName],
        [t('Event.ActualDuration'), number.format(value.actualTotalDuration)],
        [t('Event.SystemDuration'), number.format(value.systemTotalDuration)], [core('InsertedDate'), date(value.insertedDate)]]} />
    </PageGroup> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}
