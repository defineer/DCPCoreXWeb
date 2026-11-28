import { Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGlobalization } from '../globalization';
import { Panel, SelectField, WorkspaceIcon } from './primitives';
import { Toolbar, type ToolbarAction } from './toolbar';
import { DataTable } from './data-table';

export const dashboardRanges = ['Today', 'Week', 'Month', 'Year', 'All'] as const;
export type DashboardRange = typeof dashboardRanges[number];

export function DashboardToolbar({ range, changeRange, dashboardId, dashboards, changeDashboard, refresh, print, actions = [] }: {
  range: DashboardRange; changeRange: (range: DashboardRange) => void;
  dashboardId?: string; dashboards?: Array<{ id: string; name: string }>; changeDashboard?: (id: string) => void;
  refresh?: () => void; print?: () => void; actions?: ToolbarAction[];
}) {
  const { t } = useGlobalization();
  return <div className="flex flex-wrap items-end justify-between gap-4" data-print-hidden>
    <div className="flex flex-wrap items-end gap-3">
      {dashboards && changeDashboard && <SelectField label={t('App.Choose')} value={dashboardId ?? ''}
        options={dashboards.map(item => ({ value: item.id, label: item.name }))} onChange={changeDashboard} />}
      <SelectField label={t('Dashboard.Range')} value={range}
        options={dashboardRanges.map(value => ({ value, label: t('Dashboard.' + value) }))}
        onChange={value => changeRange(value as DashboardRange)} />
    </div>
    <Toolbar operation="Dashboard" actions={[
      ...(refresh ? [{ key: 'refresh', label: t('Refresh', undefined, 'Core'), icon: <WorkspaceIcon name="refresh" />, run: refresh }] : []),
      ...(print ? [{ key: 'print', label: t('Common.Print'), icon: <Printer />, run: print }] : []),
      ...actions,
    ]} />
  </div>;
}

export function DashboardLayout({ toolbar, metrics, children }: { toolbar: ReactNode; metrics?: ReactNode; children: ReactNode }) {
  return <div className="grid gap-4">{toolbar}
    {metrics && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics}</div>}
    <div className="grid gap-4 lg:grid-cols-2">{children}</div>
  </div>;
}

export function DashboardInfoItem({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  const { number } = useGlobalization();
  return <Panel className="p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
    <p className="mt-2 text-3xl font-semibold tabular-nums">{number.format(value)}</p>
  </Panel>;
}

export function DashboardBarChart({ label, data, onSelect }: {
  label: string; data: Array<{ key: string; label: string; value: number }>;
  onSelect?: (key: string) => void;
}) {
  const { number } = useGlobalization();
  const scale = Math.max(1, ...data.map(item => Math.abs(item.value)));
  const palette = ['bg-[var(--chart-1)]', 'bg-[var(--chart-2)]', 'bg-[var(--chart-3)]', 'bg-[var(--chart-4)]'];
  return <Panel className="p-4">
    <h2 className="mb-4 font-semibold">{label}</h2>
    <ul className="grid gap-3" aria-label={label}>
      {data.map((item, index) => {
        const fill = <div className="grid w-full grid-cols-[minmax(6rem,1fr)_3fr_auto] items-center gap-2 text-sm">
          <span>{item.label}</span><progress className={'h-2 w-full appearance-none rounded [&::-webkit-progress-bar]:rounded [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded ' + palette[index % palette.length]}
            aria-label={item.label} max={scale} value={Math.abs(item.value)} />
          <span className="tabular-nums">{number.format(item.value)}</span>
        </div>;
        return <li key={item.key}>{onSelect ? <button type="button" className="w-full rounded text-left" onClick={() => onSelect(item.key)}>{fill}</button> : fill}</li>;
      })}
    </ul>
  </Panel>;
}

export function ReportTable({ label, columns, rows }: {
  label: string;
  columns: Array<{ key: string; label: string; format?: 'number' | 'date' | 'text' }>;
  rows: Array<{ id: string; values: Record<string, string | number | null> }>;
}) {
  const { number, date } = useGlobalization();
  return <Panel>
    <DataTable<(typeof rows)[number]> label={label} rows={rows} rowId={row => row.id} columns={columns.map(column => ({
      key: column.key, title: column.label, render: row => {
        const value = row.values[column.key];
        if (value == null) return '–';
        if (column.format === 'number' && typeof value === 'number') return number.format(value);
        if (column.format === 'date' && typeof value === 'string') return date(value);
        return value;
      },
    }))} />
  </Panel>;
}
