import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { dashboardDateRange, type DashboardRange } from '@/shared/dashboard-range';
import { useGlobalization } from '@/shared/globalization';
import { CountDistribution } from '@/shared/ui/count-distribution';
import { DashboardRangeField } from '@/shared/ui/dashboard-range-field';
import { DefinitionList, LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { useResource } from '@/shared/resource';
import { getAiDashboard, type AiDashboard } from './ai-api';

export function AiFrameworkDashboard() { return <Dashboard kind="framework" />; }
export function AiProviderDashboard() { return <Dashboard kind="providers" />; }

function Dashboard({ kind }: { kind: AiDashboard['kind'] }) {
  const { http, state } = useSession();
  const { t, timeZone, culture } = useGlobalization();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('All');
  const customerId = state.stage === 'authenticated' ? state.session.customerId : 0;
  const load = useCallback((signal: AbortSignal) =>
    getAiDashboard(http, kind, dashboardDateRange(range, timeZone, culture), customerId, signal),
  [http, kind, range, timeZone, culture, customerId]);
  const result = useResource(load);
  const label = t(kind === 'framework' ? 'AI.Framework' : 'AI.Providers');
  const core = (key: string) => t(key, undefined, 'Core');
  return <Page id={kind === 'framework' ? 'AIFrameworkDashboard' : 'AIProviderDashboard'} title={label}>
    <Toolbar operation={label} actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />
    <PageGroup title={core('Query')}><DashboardRangeField range={range} onChange={setRange} /></PageGroup>
    <LoadingRegion loading={result.state === 'loading'}>
      {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : result.state === 'ready' && <DashboardResults data={result.data} />}
    </LoadingRegion>
  </Page>;
}

function DashboardResults({ data }: { data: AiDashboard }) {
  const { t, number } = useGlobalization();
  const common = data.value;
  const core = (key: string) => t(key, undefined, 'Core');
  if (!common.commands.length) return <StatusPanel kind="empty" />;
  const display = (value: string | null | undefined, count: number, unit = '') =>
    value ? value + ' · ' + number.format(count) + unit : '–';
  const summary = data.kind === 'framework' ? [
    [t('AI.Commands'), number.format(data.value.summary.totalCommands)],
    [core('Input'), number.format(BigInt(data.value.summary.totalInputUnits))],
    [core('Output'), number.format(BigInt(data.value.summary.totalOutputUnits))],
    [t('AI.Duration'), number.format(data.value.summary.averageDurationMs)],
  ] as [string, string][] : [
    [core('Providers'), number.format(data.value.summary.providersCount)],
    [t('AI.MostActive'), display(data.value.summary.mostActiveProviderName, data.value.summary.mostActiveProviderCommandCount)],
    [t('AI.Fastest'), display(data.value.summary.fastestProviderName, data.value.summary.fastestProviderAvgDurationMs, ' ms')],
    [t('AI.Reliability'), display(data.value.summary.mostReliableProviderName, data.value.summary.mostReliableProviderSuccessRate, '%')],
  ] as [string, string][];
  return <>
    <PageGroup title={core('General')}><DefinitionList items={summary} /></PageGroup>
    <div className="grid min-w-0 gap-2 lg:grid-cols-2">
      <PageGroup title={t('AI.Commands')}><CountDistribution rows={common.commands} /></PageGroup>
      <PageGroup title={t('AI.Units')}><CountDistribution rows={common.units} /></PageGroup>
      <PageGroup title={t('AI.Duration')}><CountDistribution rows={common.duration} /></PageGroup>
      <PageGroup title={core('Operation')}>
        {data.kind === 'framework' ? <CountDistribution rows={data.value.operations} variant="donut" />
          : <GroupedCounts rows={data.value.operations} />}
      </PageGroup>
      {data.kind === 'providers' && <PageGroup title={t('AI.Outcomes')}><GroupedCounts rows={data.value.outcomes} /></PageGroup>}
    </div>
  </>;
}

function GroupedCounts({ rows }: { rows: { category?: string | null; series?: string | null; count: number }[] }) {
  const categories = new Map<string, { name: string; count: number }[]>();
  for (const item of rows) {
    const key = item.category || '–';
    const group = categories.get(key) ?? [];
    group.push({ name: item.series || '–', count: item.count });
    categories.set(key, group);
  }
  return categories.size ? <div className="grid gap-3">
    {[...categories].map(([key, counts]) => <div key={key}><h3 className="font-semibold">{key}</h3>
      <CountDistribution rows={counts} /></div>)}
  </div> : <StatusPanel kind="empty" />;
}
