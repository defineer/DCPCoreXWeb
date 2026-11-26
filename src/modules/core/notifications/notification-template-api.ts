import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/notification/';
const identifier = z.number().int().positive();
const text = z.string().nullish();
const lifecycle = { isActive: z.boolean(), isDeleted: z.boolean() };
const language = z.object({ id: identifier, language: text, content: text, ...lifecycle });
const row = z.object({
  id: identifier, templateName: text, keyName: text, templateTypeName: text, isActive: z.boolean(), editable: z.boolean(),
});
const detail = row.omit({ templateTypeName: true }).extend({
  ...lifecycle, templateTypeId: identifier, description: text, insertedBy: z.number().int().nullish(),
  insertedDate: text, updatedBy: z.number().int().nullish(), updatedDate: text,
  templateLanguages: z.array(language).nullish().transform(value => value ?? []),
});

export type TemplateRow = z.infer<typeof row>;
export type TemplateLanguage = z.infer<typeof language>;
export type TemplateDetail = z.infer<typeof detail>;

export function getTemplates(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getwebnotificationtemplates', z.array(row), {
    method: 'POST', modifying: false, signal, body: { recordStatusQueryType: status },
  });
}

export function getTemplate(http: HttpClientManager, id: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebnotificationtemplate', { id }), detail, { signal });
}

export function getTemplateChoices(http: HttpClientManager, signal: AbortSignal) {
  return http.json(path + 'getwebnotificationtemplatechoices',
    z.object({ types: z.array(simpleData), languages: z.array(z.string()) }), { signal });
}

export async function saveTemplate(http: HttpClientManager, value: TemplateDetail, changed: TemplateLanguage[]) {
  const { id, templateName, keyName, templateTypeId, description, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savewebnotificationtemplate', commandWithData(identifier), {
    method: 'POST', body: { id, templateName, keyName, templateTypeId, description, isActive, isDeleted,
      templateLanguages: changed.map(item => ({ ...item, templateId: id })) },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteTemplate(http: HttpClientManager, id: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebnotificationtemplate', { id }), genericResponse, { method: 'POST' }));
}
