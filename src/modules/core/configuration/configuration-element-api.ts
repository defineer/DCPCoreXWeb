import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/configuration/';
const id = z.number().int().positive();
const text = z.string().nullish();
const common = {
  id, elementName: text, keyName: text, parentConfigurationElementId: id.nullish(), isSystemElement: z.boolean(), isActive: z.boolean(),
};
const row = z.object({ ...common, typeId: id, typeName: text, parentElementName: text, licenceTypeName: text });
const detail = z.object({
  ...common, configurationElementTypeId: id, licenceTypeId: id, listOrder: z.number().int(), description: text,
  isDeleted: z.boolean(), insertedDate: text, updatedDate: text,
  insertedBy: z.number().int().nullish(), updatedBy: z.number().int().nullish(),
});
const choices = z.object({ types: z.array(simpleData), licenceTypes: z.array(simpleData) });
const version = z.object({
  id, customerId: z.number().int(), configurationElementTypeSchemaVersionId: id, version: text,
  versionDate: text, installedDate: text, objectTypeId: z.number().int(), objectId: z.string(),
  isActive: z.boolean(),
});

export type ConfigurationElementRow = z.infer<typeof row>;
export type ConfigurationElement = z.infer<typeof detail>;
export type ConfigurationElementChoices = z.infer<typeof choices>;
export type ConfigurationVersion = z.infer<typeof version>;

export function getConfigurationElements(http: HttpClientManager, tree: boolean, configurationElementTypeId: number,
  recordStatusQueryType: RecordStatus, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationelements', { tree: String(tree) }), z.array(row), {
    method: 'POST', modifying: false, body: { configurationElementTypeId, recordStatusQueryType }, signal,
  });
}

export function getConfigurationElement(http: HttpClientManager, tree: boolean, elementId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationelement', { tree: String(tree), id: elementId }), detail, { signal });
}

export function getConfigurationElementChoices(http: HttpClientManager, tree: boolean, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationelementchoices', { tree: String(tree) }), choices, { signal });
}

export function getConfigurationVersionMetadata(http: HttpClientManager, tree: boolean, configurationElementId: number,
  recordStatusQueryType: RecordStatus, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationelementversionmetadata', { tree: String(tree) }), z.array(version), {
    method: 'POST', modifying: false, body: { configurationElementId, recordStatusQueryType }, signal,
  });
}

export async function saveConfigurationElement(http: HttpClientManager, tree: boolean, value: ConfigurationElement) {
  const { id: elementId, elementName, keyName, parentConfigurationElementId, configurationElementTypeId, licenceTypeId,
    listOrder, description, isSystemElement, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(withQuery(path + 'savewebconfigurationelement', { tree: String(tree) }),
    commandWithData(id), { method: 'POST', body: { id: elementId, elementName, keyName, parentConfigurationElementId,
      configurationElementTypeId, licenceTypeId, listOrder, description, isSystemElement, isActive, isDeleted } }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteConfigurationElement(http: HttpClientManager, tree: boolean, elementId: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebconfigurationelement', { tree: String(tree), id: elementId }),
    genericResponse, { method: 'POST' }));
}
