import { z } from 'zod';
import { pagedResponse, simpleData } from '@/shared/contracts';
import { withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/event/';
const text = z.string().nullish();
const record = z.object({
  eventKey: z.string().regex(/^[1-9][0-9]*$/), eventDate: z.string(), severity: text,
  eventType: text, rootGroup: text, group: text, customerKey: text, sessionUserName: text,
});
const detail = record.extend({
  actualTotalDuration: z.number().int(), systemTotalDuration: z.number().int(), insertedDate: z.string(),
});
const choices = z.object({ roots: z.array(simpleData), groups: z.array(simpleData), types: z.array(simpleData) });
export type EventRecord = z.infer<typeof record>;
export interface EventSearchCriteria {
  localStartDate: string;
  localEndDate: string;
  rootGroupId?: number;
  groupId?: number;
  eventTypeId?: number;
  severity?: string;
}

export function getEventRecordChoices(http: HttpClientManager, rootGroupId: number | undefined, groupId: number | undefined,
  signal: AbortSignal) {
  const filters: Record<string, number> = {};
  if (rootGroupId !== undefined) filters.rootGroupId = rootGroupId;
  if (groupId !== undefined) filters.groupId = groupId;
  return http.json(withQuery(path + 'getwebeventsearchchoices', filters), choices, { signal });
}

export function queryEventRecords(http: HttpClientManager, criteria: EventSearchCriteria, page: number, pageSize: number,
  signal: AbortSignal) {
  return http.json(path + 'querywebeventrecords', pagedResponse(record), {
    method: 'POST', modifying: false, body: { ...criteria, page, pageSize }, signal,
  });
}

export function getEventRecord(http: HttpClientManager, eventKey: string, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebeventrecord', { eventKey }), detail, { signal });
}
