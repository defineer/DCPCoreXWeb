import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/notification/';
const identifier = z.number().int().positive();
const text = z.string().nullish();
const row = z.object({ id: identifier, notificationName: text, keyName: text, isActive: z.boolean() });
const item = z.object({
  id: identifier, notificationTypeId: identifier, notificationTemplateId: identifier, notificationTypeContent: text,
  isActive: z.boolean(), isDeleted: z.boolean(),
});
const detail = row.extend({
  description: text, isDeleted: z.boolean(), insertedBy: z.number().int().nullish(), insertedDate: text,
  updatedBy: z.number().int().nullish(), updatedDate: text,
  notificationItems: z.array(item).nullish().transform(value => value ?? []),
});
const choices = z.object({ channels: z.array(simpleData),
  templates: z.array(simpleData.extend({ notificationTypeId: identifier })) });
export type NotificationRow = z.infer<typeof row>;
export type NotificationRecord = z.infer<typeof detail>;
export type NotificationItem = z.infer<typeof item>;
export type NotificationChoices = z.infer<typeof choices>;

export function getNotifications(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getwebnotifications', z.array(row), {
    method: 'POST', modifying: false, body: { recordStatusQueryType: status }, signal,
  });
}

export function getNotification(http: HttpClientManager, id: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebnotification', { id }), detail, { signal });
}

export function getNotificationChoices(http: HttpClientManager, signal: AbortSignal) {
  return http.json(path + 'getwebnotificationchoices', choices, { signal });
}

export async function saveNotification(http: HttpClientManager, value: NotificationRecord, items: NotificationItem[]) {
  const { id, notificationName, keyName, description, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savewebnotification', commandWithData(identifier), {
    method: 'POST',
    body: { id, notificationName, keyName, description, isActive, isDeleted, notificationItems: items },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteNotification(http: HttpClientManager, id: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebnotification', { id }), genericResponse, { method: 'POST' }));
}
