import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { PagedDataTable, type Column } from '@/shared/ui/data-table';
import { LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';

const path = '/api/report/';
const rowsSchema = z.array(z.record(z.string(), z.unknown()));
type ResultRow = z.infer<typeof rowsSchema>[number];
function cell(value: unknown) {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SqlClient() {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');
  const [commandText, setCommandText] = useState('');
  const [rows, setRows] = useState<ResultRow[]>();
  const [failure, setFailure] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const load = useCallback((signal: AbortSignal) => http.json(path + 'connections', z.array(z.string()), { signal }), [http]);
  const connections = useResource(load);
  const allowed = connections.state === 'ready' ? connections.data : [];
  const connectionKey = allowed.includes(selected) ? selected : allowed[0] ?? '';
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Report.SqlClient');
  const headings = [...new Set((rows ?? []).flatMap(row => Object.keys(row)))];
  const columns: Column<{ index: number; values: ResultRow }>[] = headings.map(key => ({
    key, title: key, render: row => cell(Object.hasOwn(row.values, key) ? row.values[key] : undefined),
  }));

  async function execute() {
    if (running.current || !connectionKey || !commandText.trim()) return;
    running.current = true;
    setPending(true);
    setFailure(undefined);
    setRows(undefined);
    try {
      const result = await http.json(path + 'executesqlcommand', rowsSchema, {
        method: 'POST', body: { commandText, connectionKey },
      });
      setRows(result);
    } catch (failure) { setFailure(failure); }
    finally { running.current = false; setPending(false); }
  }

  return <Page id="SqlClient" title={title}>
    <Toolbar operation="SqlClient" actions={[
      { key: 'execute', label: t('Report.Execute'), enabled: Boolean(connectionKey && commandText.trim()) && !pending, run: execute },
      { key: 'clear', label: core('Clear'), enabled: Boolean(commandText) && !pending, run: () => {
        setCommandText(''); setRows(undefined); setFailure(undefined);
      } },
      { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: Boolean(rows?.length) && !pending,
        actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
          if (!rows) return;
          try {
            await exportTable(format, 'report-results', [headings,
              ...rows.map(row => headings.map(heading => cell(Object.hasOwn(row, heading) ? row[heading] : undefined)))]);
          } catch (failure) { toast.error(error(failure)); }
        } })) },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, enabled: !pending, run: () => navigate('/index') },
    ]} />
    <PageGroup title={core('Query')}>
      {connections.state === 'error' ? <StatusPanel kind="error" error={connections.error} retry={connections.refresh} />
        : connections.state === 'loading' ? <StatusPanel kind="loading" /> : allowed.length ? <div className="grid gap-2">
          <SelectField label={t('Report.Connection')} value={connectionKey} options={allowed.map(name => ({ value: name, label: name }))}
            disabled={pending} onChange={setSelected} />
          <TextAreaField label={t('Report.Statement')} value={commandText} onChange={setCommandText}
            maxLength={32768} rows={12} readOnly={pending} />
        </div> : <p>{t('Report.NoConnections')}</p>}
    </PageGroup>
    <LoadingRegion loading={pending}>
      {failure ? <StatusPanel kind="error" error={failure} /> : rows && <PageGroup title={t('Report.Results')}>
        {rows.length ? <PagedDataTable pagerPosition="Bottom" label={t('Report.Results')} rows={rows.map((values, index) => ({ values, index }))}
          columns={columns} rowId={row => row.index} resizable /> : <StatusPanel kind="empty" />}
      </PageGroup>}
    </LoadingRegion>
  </Page>;
}
