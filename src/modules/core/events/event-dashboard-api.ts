import { z } from 'zod';
import { withQuery, type HttpClientManager } from '@/shared/http';

const series = z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() }));
const dashboardData = z.object({ rootGroups: series, groups: series, eventTypes: series });

export function getEventDashboard(http: HttpClientManager, range: { localStartDate: string; localEndDate: string } | undefined,
  signal: AbortSignal) {
  const path = '/api/event/getwebeventdashboard';
  return http.json(range ? withQuery(path, range) : path, dashboardData, { signal });
}
