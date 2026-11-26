import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/event/';
const id = z.number().int().positive();
const text = z.string().nullish();
export const eventSeverities = ['Critical', 'High', 'Medium', 'Low', 'Information'] as const;
export const processManagers = ['Default', 'MultipleQueue', 'Workflow'] as const;
type EventSeverity = typeof eventSeverities[number] | '';
const severity = z.union([z.enum(eventSeverities), z.number().int().min(0).max(eventSeverities.length)])
  .transform((value): EventSeverity => typeof value === 'number' ? eventSeverities[value - 1] || '' : value);
const eventRow = z.object({
  id, eventName: text, eventTypeName: text, severityId: severity, isActive: z.boolean(), isSystemEvent: z.boolean().optional(),
});
const eventRecord = eventRow.omit({ eventTypeName: true }).extend({
  keyName: text, processManagerKeyName: text, eventTypeId: z.number().int(), description: text,
  isSystemEvent: z.boolean(), isDeleted: z.boolean(), insertedBy: z.number().int().nullish(),
  insertedDate: text, updatedBy: z.number().int().nullish(), updatedDate: text,
});
export type EventRow = z.infer<typeof eventRow>;
export type EventRecord = z.infer<typeof eventRecord>;

export function getEvents(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getevents', z.array(eventRow), {
    method: 'POST', modifying: false, body: { recordStatusQueryType: status }, signal,
  });
}

export function getEvent(http: HttpClientManager, eventId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getevent', { eventId }), eventRecord, { signal });
}

export function getEventTypes(http: HttpClientManager, activeOnly: boolean, signal: AbortSignal) {
  return http.json(withQuery(path + 'geteventtypessimple', { activeOnly: String(activeOnly) }), z.array(simpleData), { signal });
}

export async function saveEvent(http: HttpClientManager, value: EventRecord) {
  const { id: eventId, eventName, keyName, processManagerKeyName, eventTypeId, description, severityId,
    isSystemEvent, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'saveevent', commandWithData(id), {
    method: 'POST', body: { id: eventId, eventName, keyName, processManagerKeyName, eventTypeId, description, severityId,
      isSystemEvent, isActive, isDeleted },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteEvent(http: HttpClientManager, eventId: number) {
  confirmCommand(await http.json(withQuery(path + 'deleteevent', { eventId }), genericResponse, { method: 'POST' }));
}
