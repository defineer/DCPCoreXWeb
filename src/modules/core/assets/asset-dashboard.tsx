import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { dashboardDateRange, type DashboardRange } from '@/shared/dashboard-range';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { CountDistribution } from '@/shared/ui/count-distribution';
import { DashboardRangeField } from '@/shared/ui/dashboard-range-field';
import { DataTable } from '@/shared/ui/data-table';
import { LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { getAssetTypeCounts } from './asset-api';

export function AssetDashboard() {
  const { http } = useSession();
  const { t, culture, timeZone, number } = useGlobalization();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('All');
  const load = useCallback((signal: AbortSignal) =>
    getAssetTypeCounts(http, dashboardDateRange(range, timeZone, culture), signal), [http, range, timeZone, culture]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const rows = result.state === 'ready' ? result.data : [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const largest = rows.reduce<(typeof rows)[number] | undefined>((max, row) => !max || row.count > max.count ? row : max, undefined);
  return <Page id="AssetDashboard" title={t('Asset.Dashboard')}>
    <Toolbar operation="AssetDashboard" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />
    <PageGroup title={core('Query')}><DashboardRangeField range={range} onChange={setRange} /></PageGroup>
    <LoadingRegion loading={result.state === 'loading'}>
      {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} /> : <>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <PageGroup title={core('Assets')}><p className="text-2xl font-semibold tabular-nums">{number.format(total)}</p></PageGroup>
          {largest && <PageGroup title={largest.name}>
            <p className="text-2xl font-semibold tabular-nums">{number.format(largest.count)}</p>
          </PageGroup>}
        </div>
        <div className="grid min-w-0 gap-2 lg:grid-cols-2">
          <PageGroup title={t('Asset.ByType')}>
            <DataTable label={core('Assets')} rows={rows} rowId={row => row.name} columns={[
              { key: 'name', title: core('Name'), render: row => row.name },
              { key: 'count', title: core('Count'), render: row => number.format(row.count), numeric: true },
            ]} resizable />
          </PageGroup>
          <PageGroup title={t('Asset.ByType')}>
            <CountDistribution rows={rows} />
          </PageGroup>
        </div>
      </>}
    </LoadingRegion>
  </Page>;
}
