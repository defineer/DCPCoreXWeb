import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { dashboardDateRange, type DashboardRange } from '@/shared/dashboard-range';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { CountDistribution, type CountEntry } from '@/shared/ui/count-distribution';
import { DashboardRangeField } from '@/shared/ui/dashboard-range-field';
import { LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { getEventDashboard } from './event-dashboard-api';

export function EventDashboard() {
  const { http } = useSession();
  const { t, culture, timeZone, number } = useGlobalization();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('All');
  const load = useCallback((signal: AbortSignal) =>
    getEventDashboard(http, dashboardDateRange(range, timeZone, culture), signal), [http, range, timeZone, culture]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const data = result.state === 'ready' ? result.data : undefined;
  const total = data?.eventTypes.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const highest = data?.rootGroups.reduce<CountEntry | undefined>((max, row) =>
    !max || row.count > max.count ? row : max, undefined);
  return <Page id="EventDashboard" title={t('Event.Dashboard')}>
    <Toolbar operation="EventDashboard" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />
    <PageGroup title={core('Query')}><DashboardRangeField range={range} onChange={setRange} /></PageGroup>
    <LoadingRegion loading={result.state === 'loading'}>
      {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} /> : data && <>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <PageGroup title={core('Events')}><p className="text-2xl font-semibold tabular-nums">{number.format(total)}</p></PageGroup>
          {highest && <PageGroup title={highest.name}>
            <p className="text-2xl font-semibold tabular-nums">{number.format(highest.count)}</p>
          </PageGroup>}
        </div>
        <div className="grid min-w-0 gap-2 lg:grid-cols-2">
          <PageGroup title={t('Event.RootGroups')}><CountDistribution rows={data.rootGroups} variant="donut" /></PageGroup>
          <PageGroup title={core('Groups')}><CountDistribution rows={data.groups} variant="donut" /></PageGroup>
          <PageGroup title={t('Event.ByType')}><CountDistribution rows={data.eventTypes} /></PageGroup>
          <PageGroup title={t('Event.TypeDistribution')}><CountDistribution rows={data.eventTypes} variant="donut" /></PageGroup>
        </div>
      </>}
    </LoadingRegion>
  </Page>;
}
