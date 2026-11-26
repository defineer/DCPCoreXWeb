import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/event/';
const identifier = z.number().int().positive();
const row = z.object({ id: identifier, notificationName: z.string().nullish(), isActive: z.boolean() });
const detail = row.omit({ notificationName: true }).extend({
  notificationId: identifier, eventId: identifier, isDeleted: z.boolean(),
  insertedBy: z.number().int().nullish(), insertedDate: z.string().nullish(),
  updatedBy: z.number().int().nullish(), updatedDate: z.string().nullish(),
});

export type EventNotificationRow = z.infer<typeof row>;
export type EventNotification = z.infer<typeof detail>;

export function getEventNotifications(http: HttpClientManager, eventId: number, status: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getwebeventnotifications', z.array(row), {
    method: 'POST', modifying: false, body: { eventId, recordStatusQueryType: status }, signal,
  });
}

export function getEventNotification(http: HttpClientManager, eventId: number, id: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebeventnotification', { eventId, id }), detail, { signal });
}

export function getEventNotificationChoices(http: HttpClientManager, eventId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebeventnotificationchoices', { eventId }), z.array(simpleData), { signal });
}

export async function saveEventNotification(http: HttpClientManager, value: EventNotification) {
  const { id, eventId, notificationId, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savewebeventnotification', commandWithData(identifier), {
    method: 'POST', body: { id, eventId, notificationId, isActive, isDeleted },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteEventNotification(http: HttpClientManager, eventId: number, id: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebeventnotification', { eventId, id }), genericResponse, { method: 'POST' }));
}
