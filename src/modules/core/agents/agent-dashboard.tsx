import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { dashboardDateRange, type DashboardRange } from '@/shared/dashboard-range';
import { useGlobalization } from '@/shared/globalization';
import { withQuery } from '@/shared/http';
import { useResource } from '@/shared/resource';
import { CountDistribution } from '@/shared/ui/count-distribution';
import { DashboardRangeField } from '@/shared/ui/dashboard-range-field';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { DefinitionList, LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';

const agent = z.object({
  agentId: z.string().nullish(), agentName: z.string(), agentServiceIP: z.string(), agentPort: z.number().int(),
  agentTypeKeyName: z.string(), startTime: z.string().nullish(),
});
const countsSchema = z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() }));
type Agent = z.infer<typeof agent>;

export function AgentDashboard() {
  const { http } = useSession();
  const { t, timeZone, culture, date, number } = useGlobalization();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('All');
  const load = useCallback(async (signal: AbortSignal) => {
    const dates = dashboardDateRange(range, timeZone, culture);
    const endpoint = (method: string) => {
      const path = '/api/agent/' + method;
      return dates ? withQuery(path, dates) : path;
    };
    const [agents, counts] = await Promise.all([
      http.json(endpoint('getagentsinfo'), z.array(agent), { signal, exactIntegerFields: ['agentId'] }),
      http.json(endpoint('getagentscountbytype'), countsSchema, { signal }),
    ]);
    return { agents, counts };
  }, [http, range, timeZone, culture]);
  const result = useResource(load);
  const data = result.state === 'ready' ? result.data : undefined;
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Agent.Dashboard');
  const columns: Column<Agent>[] = [
    { key: 'name', title: core('Name'), render: item => item.agentName },
    { key: 'type', title: core('Type'), render: item => item.agentTypeKeyName },
    { key: 'ip', title: core('IP'), render: item => item.agentServiceIP },
    { key: 'port', title: core('Port'), render: item => number.format(item.agentPort), numeric: true },
    { key: 'start', title: core('StartDate'), render: item => date(item.startTime) },
    { key: 'status', title: core('Status'), render: item => t(item.startTime ? 'Service.Registered' : 'Service.Unregistered') },
  ];
  return <Page id="AgentDashboard" title={title}>
    <Toolbar operation="AgentDashboard" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />, run: result.refresh },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />
    <PageGroup title={core('Query')}><DashboardRangeField range={range} onChange={setRange} /></PageGroup>
    <LoadingRegion loading={result.state === 'loading'}>
      {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} /> : data && <>
        <PageGroup title={t('Agent.Registrations')}>
          <DefinitionList items={[[core('Count'), number.format(data.agents.length)],
            [core('Active'), number.format(data.agents.filter(item => item.startTime).length)]]} />
          <DataTable label={t('Agent.Registrations')} rows={data.agents} columns={columns}
            rowId={item => item.agentId || item.agentName} resizable />
        </PageGroup>
        <PageGroup title={t('Agent.ByType')}><CountDistribution rows={data.counts} variant="donut" /></PageGroup>
      </>}
    </LoadingRegion>
  </Page>;
}
