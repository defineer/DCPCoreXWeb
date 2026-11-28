import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { pagedResponse } from '@/shared/contracts';
import { useResource } from '@/shared/resource';
import { useGlobalization } from '@/shared/globalization';
import { localDateInput } from '@/shared/zoned-dates';
import { DataTable, ListPage, Pagination } from '@/shared/ui/data-table';
import { Button, Field, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { Toolbar } from '@/shared/ui/toolbar';
import type { ExportFormat } from '@/shared/export';
import { toast } from '@/shared/ui/toasts';

const sessionRow = z.object({ startDate: z.string(), endDate: z.string().nullish(),
  sessionFailedReason: z.string().nullish(), isSuccess: z.boolean() });
type SessionRow = z.infer<typeof sessionRow>;
export function SessionsPage() {
  const { http, state } = useSession();
  const { preferences } = useWorkspace();
  const { t, date, error, timeZone } = useGlobalization();
  const pageSize = Math.max(10, Math.min(60, preferences?.rowsPerPage ?? 20));
  const pagerPosition = preferences?.gridPagerPosition;
  const navigate = useNavigate();
  const userId = state.stage === 'authenticated' ? state.session.userId : 0;
  const [criteria, setCriteria] = useState(() => {
    const today = localDateInput(new Date().toISOString(), timeZone);
    return { localStartDate: today.slice(0, 8) + '01', localEndDate: today, success: false, userSessionFailedReason: 0 };
  });
  const [query, setQuery] = useState(criteria);
  const [page, setPage] = useState(1);
  const [invalid, setInvalid] = useState(false);
  const load = useCallback((signal: AbortSignal) => http.json('/api/userservice/getusersessions',
    pagedResponse(sessionRow), { method: 'POST', modifying: false, signal, body: {
      ...query, userId, userSessionFailedReason: query.success ? null : (query.userSessionFailedReason || null),
      startDate: query.localStartDate + 'T00:00:00', endDate: query.localEndDate + 'T23:59:59',
      dataFilter: { page, pageSize },
    } }), [http, query, page, pageSize, userId]);
  const result = useResource(load);
  const title = t('Sessions', undefined, 'Core');
  const rows = result.state === 'ready' ? result.data.data : [];
  const displayed = result.state === 'ready' ? result.data : result.state === 'loading' ? result.previousData : undefined;
  const pager = displayed && <Pagination page={page} pageSize={pageSize} total={displayed.totalRecords} onPage={setPage} direct />;
  const width = query.success ? '33.33%' : '25%';
  const columns = [
    { key: 'startDate', title: t('Field.StartDate'), render: (row: SessionRow) => date(row.startDate), width },
    { key: 'endDate', title: t('Field.EndDate'), render: (row: SessionRow) => date(row.endDate), width },
    { key: 'success', title: t('Field.Success'), render: (row: SessionRow) => t(row.isSuccess ? 'Yes' : 'No', undefined, 'Core'), width },
    ...(!query.success ? [{ key: 'reason', title: t('SessionFailedReason', undefined, 'Core'), render: (row: SessionRow) => row.sessionFailedReason ?? '–', width }] : []),
  ];
  async function exportResults(format: ExportFormat) {
    if (!rows.length) return;
    try {
      const { exportTable } = await import('@/shared/export');
      await exportTable(format, 'sessions-page-' + page,
        [columns.map(column => column.title), ...rows.map(row => columns.map(column => column.render(row)))]);
    } catch (failure) { toast.error(error(failure)); }
  }

  return <Page id="MySessions" title={title}>
    <ListPage split resultsTitle={title} tools={<Toolbar operation="MySessions" actions={[
      { key: 'export', label: t('Export', undefined, 'Core'), accessibleLabel: t('Common.Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
        actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: () => exportResults(format) })) },
      { key: 'refresh', label: t('Refresh', undefined, 'Core'), icon: <WorkspaceIcon name="refresh" />, run: result.refresh },
      { key: 'close', label: t('Close', undefined, 'Core'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />} query={<form noValidate className="workspace-fields grid gap-3" onSubmit={event => {
      event.preventDefault();
      if (!criteria.localStartDate || !criteria.localEndDate || criteria.localStartDate > criteria.localEndDate) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setPage(1);
      setQuery({ ...criteria });
    }}>
      <Field label={t('Field.StartDate')} type="date" value={criteria.localStartDate}
        onChange={value => setCriteria({ ...criteria, localStartDate: value })} />
      <Field label={t('Field.EndDate')} type="date" value={criteria.localEndDate}
        error={invalid ? t('Common.Invalid') : undefined} onChange={value => setCriteria({ ...criteria, localEndDate: value })} />
      <label className="workspace-field"><span>{t('Field.Success')}</span>
        <input type="checkbox" role="switch" className="workspace-switch" checked={criteria.success}
          onChange={event => setCriteria({ ...criteria, success: event.target.checked })} />
      </label>
      {!criteria.success && <SelectField label={t('SessionFailedReason', undefined, 'Core')} value={criteria.userSessionFailedReason}
        options={[{ value: 0, label: t('Common.All') }, ...[1, 2, 3, 4, 5, 6].map(value => ({
          value, label: t('Session.Reason' + value),
        }))]} onChange={value => setCriteria({ ...criteria, userSessionFailedReason: Number(value) })} />}
      <Button className="workspace-search justify-self-start" type="submit"><WorkspaceIcon name="search" />{t('Query', undefined, 'Core')}</Button>
    </form>}>
      {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
      {result.state !== 'error' && <LoadingRegion loading={result.state === 'loading'}>
        {(pagerPosition === 'Top' || pagerPosition === 'TopAndBottom') && pager}
        <DataTable label={title} rows={displayed?.data ?? []} rowId={row => row.startDate + ':' + row.endDate} columns={columns} resizable />
        {pagerPosition !== 'Top' && pager}
      </LoadingRegion>}
    </ListPage>
  </Page>;
}
