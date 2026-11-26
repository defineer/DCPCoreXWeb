import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { dashboardDateRange, type DashboardRange } from '@/shared/dashboard-range';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { CountDistribution } from '@/shared/ui/count-distribution';
import { DashboardRangeField } from '@/shared/ui/dashboard-range-field';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { DefinitionList, LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';

const services = z.object({
  serviceId: z.string().nullish(), serviceName: z.string().nullish(), serviceIP: z.string().nullish(),
  port: z.number().int(), startTime: z.string().nullish(),
});
const responses = z.object({
  name: z.string(), minResponseTimeMs: z.number(), maxResponseTimeMs: z.number(), avgResponseTimeMs: z.number(),
});
const requests = z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() }));
type Service = z.infer<typeof services>;
type Response = z.infer<typeof responses>;

export function ServiceDashboard() {
  const { http, state } = useSession();
  const { t, number, culture, timeZone } = useGlobalization();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('All');
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!common) return undefined;
    const filters = dashboardDateRange(range, timeZone, culture);
    const body = (dataType: string) => ({
      dataType, propertyName: 'Name',
      ...(filters ?? { startTime: '0001-01-01T00:00:00Z', endTime: '9999-12-31T23:59:59Z' }),
    });
    const [discovered, responseStats, requestStats] = await Promise.all([
      http.json('/api/servicemanagement/getservicelist', z.array(services), { signal }),
      http.json('/api/event/queryeventsanalysis', z.array(responses), {
        method: 'POST', signal, body: body('ServiceResponseProcessed'),
      }),
      http.json('/api/event/queryeventscount', requests, {
        method: 'POST', signal, body: body('ServiceRequestProcessed'),
      }),
    ]);
    return { services: discovered, responses: responseStats, requests: requestStats };
  }, [common, http, range, timeZone, culture]);
  const result = useResource(load);
  const data = result.state === 'ready' ? result.data : undefined;
  const core = (key: string) => t(key, undefined, 'Core');
  const serviceColumns: Column<Service>[] = [
    { key: 'name', title: core('Name'), render: row => row.serviceName ?? '–' },
    { key: 'ip', title: core('IP'), render: row => row.serviceIP ?? '–' },
    { key: 'port', title: core('Port'), render: row => row.port ? number.format(row.port) : '–', numeric: true },
    { key: 'status', title: core('Status'), render: row => t(row.startTime ? 'Service.Registered' : 'Service.Unregistered') },
  ];
  const responseColumns: Column<Response>[] = [
    { key: 'name', title: core('Name'), render: row => row.name },
    { key: 'min', title: core('Min') + ' (ms)', render: row => number.format(row.minResponseTimeMs), numeric: true },
    { key: 'max', title: core('Max') + ' (ms)', render: row => number.format(row.maxResponseTimeMs), numeric: true },
    { key: 'avg', title: core('Avg') + ' (ms)', render: row => number.format(row.avgResponseTimeMs), numeric: true },
  ];
  const total = data?.requests.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const maximum = data?.responses.reduce((value, row) => Math.max(value, row.maxResponseTimeMs), 0) ?? 0;
  const minimum = data?.responses.length
    ? data.responses.reduce((value, row) => Math.min(value, row.minResponseTimeMs), Infinity) : 0;
  const average = data?.responses.length
    ? Math.trunc(data.responses.reduce((sum, row) => sum + row.avgResponseTimeMs, 0) / data.responses.length) : 0;

  return <Page id="ServiceDashboard" title={t('Service.Dashboard')}>
    <Toolbar operation="ServiceDashboard" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh, enabled: common },
      { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
    ]} />
    {common ? <>
      <PageGroup title={core('Query')}><DashboardRangeField range={range} onChange={setRange} /></PageGroup>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} /> : data && <>
          <PageGroup title={core('ServiceStatus')}>
            <DataTable label={core('ServiceStatus')} rows={data.services} columns={serviceColumns}
              rowId={row => row.serviceId ?? [row.serviceName, row.serviceIP, row.port].join('/')} resizable />
          </PageGroup>
          <PageGroup title={core('ServiceResponses')}>
            <DefinitionList items={[[core('Min') + ' (ms)', number.format(minimum)],
              [core('Max') + ' (ms)', number.format(maximum)], [core('Avg') + ' (ms)', number.format(average)]]} />
            <DataTable label={core('ServiceResponses')} rows={data.responses} columns={responseColumns} rowId={row => row.name} resizable />
          </PageGroup>
          <PageGroup title={core('ServiceRequests')}>
            <p className="text-lg font-semibold tabular-nums">{number.format(total)}</p>
            <div className="grid min-w-0 gap-2 lg:grid-cols-2">
              <CountDistribution rows={data.requests} />
              <CountDistribution rows={data.requests} variant="donut" />
            </div>
          </PageGroup>
        </>}
      </LoadingRegion>
    </> : <StatusPanel kind="denied" />}
  </Page>;
}
