import { z } from 'zod';
import { commandWithData, genericResponse, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/configuration/';
const id = z.number().int().positive();
const text = z.string().nullish();
const status = { isActive: z.boolean() };
const audit = {
  isDeleted: z.boolean(), insertedDate: text, updatedDate: text,
  insertedBy: z.number().int().nullish(), updatedBy: z.number().int().nullish(),
};
const typeRow = z.object({
  id, typeName: text, keyName: text, parentTypeName: text, parentConfigurationElementTypeId: id.nullish(), ...status,
});
const typeDetail = typeRow.extend({ ...audit, description: text });
const schemaRow = z.object({
  id, configurationElementTypeId: id, version: text, versionDate: z.string(), contentSchema: text, ...status,
});
const schemaDetail = schemaRow.extend({ ...audit, versionDateWithOffset: text });
const parentOption = typeRow.pick({ id: true, typeName: true, isActive: true });

export type ConfigurationTypeRow = z.infer<typeof typeRow>;
export type ConfigurationType = z.infer<typeof typeDetail>;
export type ConfigurationSchemaRow = z.infer<typeof schemaRow>;
export type ConfigurationSchema = z.infer<typeof schemaDetail>;
export type ConfigurationParent = z.infer<typeof parentOption>;

export function getConfigurationTypes(http: HttpClientManager, recordStatusQueryType: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getwebconfigurationelementtypes', z.array(typeRow), {
    method: 'POST', modifying: false, body: { recordStatusQueryType }, signal,
  });
}

export function getConfigurationType(http: HttpClientManager, typeId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationelementtype', { id: typeId }), typeDetail, { signal });
}

export function getConfigurationTypeChoices(http: HttpClientManager, signal: AbortSignal) {
  return http.json(path + 'getwebconfigurationelementtypechoices', z.array(parentOption), { signal });
}

export async function saveConfigurationType(http: HttpClientManager, value: ConfigurationType) {
  const { id: typeId, typeName, keyName, parentConfigurationElementTypeId, description, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savewebconfigurationelementtype', commandWithData(id), {
    method: 'POST',
    body: { id: typeId, typeName, keyName, parentConfigurationElementTypeId, description, isActive, isDeleted },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteConfigurationType(http: HttpClientManager, typeId: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebconfigurationelementtype', { id: typeId }),
    genericResponse, { method: 'POST' }));
}

export function getConfigurationSchemas(http: HttpClientManager, configurationElementTypeId: number,
  recordStatusQueryType: RecordStatus, signal: AbortSignal) {
  return http.json(path + 'getwebconfigurationtypeschemas', z.array(schemaRow), {
    method: 'POST', modifying: false, body: { configurationElementTypeId, recordStatusQueryType }, signal,
  });
}

export function getConfigurationSchema(http: HttpClientManager, typeId: number, schemaId: number, signal: AbortSignal) {
  return http.json(withQuery(path + 'getwebconfigurationtypeschema', { typeId, id: schemaId }), schemaDetail, { signal });
}

export async function saveConfigurationSchema(http: HttpClientManager, value: ConfigurationSchema, versionDateWithOffset: string) {
  const { id: schemaId, configurationElementTypeId, contentSchema, version, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savewebconfigurationtypeschema', commandWithData(id), {
    method: 'POST', body: { id: schemaId, configurationElementTypeId, contentSchema, version,
      versionDateWithOffset, isActive, isDeleted },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteConfigurationSchema(http: HttpClientManager, typeId: number, schemaId: number) {
  confirmCommand(await http.json(withQuery(path + 'deletewebconfigurationtypeschema', { typeId, id: schemaId }),
    genericResponse, { method: 'POST' }));
}
