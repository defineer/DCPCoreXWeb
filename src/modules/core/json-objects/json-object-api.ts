import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/jsonobject/';
const id = z.string().regex(/^[1-9][0-9]*$/);
const text = z.string().nullish();
const detail = z.object({
  id, name: text, typeId: z.number().int(), schemaId: z.number().int(), parentId: id.nullish(),
  content: text, description: text, isActive: z.boolean(), isDeleted: z.boolean(), insertedDate: text,
  updatedDate: text, insertedBy: z.number().int().nullish(), updatedBy: z.number().int().nullish(),
  objectId: text, objectTypeId: z.number().int().nullish(),
});
const typeRow = simpleData.omit({ name: true }).extend({
  typeName: text, isActive: z.boolean(), parentObjectTypeId: z.number().int().nullish(),
});
const types = z.array(typeRow.transform(({ typeName, parentObjectTypeId, ...rest }) =>
  ({ ...rest, name: typeName, parentTypeId: parentObjectTypeId })));
export interface JsonObjectRow { id: string; name?: string | null; type?: string | null; parent?: string | null; isActive: boolean }
export type JsonObjectDetail = z.infer<typeof detail>;
export type JsonObjectType = z.infer<typeof types>[number];
export interface JsonObjectChoices { schemas: z.infer<typeof simpleData>[]; parents: { id: string; name?: string | null }[] }
export interface JsonObjectQuery { start: string; end: string; status: RecordStatus; typeId: number; parentId?: string }

export function getJsonTypes(http: HttpClientManager, signal: AbortSignal) {
  return http.json(path + 'getjsonobjecttypessimple', types, { signal });
}
export async function getJsonChoices(http: HttpClientManager, typeId: number, signal: AbortSignal) {
  const [allTypes, schemas] = await Promise.all([
    getJsonTypes(http, signal),
    http.json(withQuery(path + 'getjsonobjecttypeschemaversions', { jsonObjectTypeId: typeId }), z.array(simpleData), { signal }),
  ]);
  const parentTypeId = allTypes.find(item => item.id === typeId)?.parentTypeId;
  const parents = parentTypeId ? await http.json(withQuery(path + 'getjsonobjectitemssimple', { jsonObjectTypeId: parentTypeId }),
    z.array(z.object({ id, name: text })), { signal, exactIntegerFields: ['id'] }) : [];
  return { schemas, parents };
}
export function getJsonObjects(http: HttpClientManager, query: JsonObjectQuery, signal: AbortSignal) {
  const { start, end, status, typeId, parentId } = query;
  return http.json(path + 'getjsonobjects', z.array(z.object({
    id, objectName: text, jsonObjectTypeName: text, parentJsonObjectItemName: text, isActive: z.boolean(),
  }).transform(item => ({
    id: item.id, name: item.objectName, type: item.jsonObjectTypeName, parent: item.parentJsonObjectItemName, isActive: item.isActive,
  }))), { method: 'POST', signal, exactIntegerFields: ['id'], body: { localStartDate: start, localEndDate: end, recordStatusQueryType: status,
    jsonObjectTypeId: typeId || -1, parentJsonObjectItemId: parentId } });
}
export function getJsonObject(http: HttpClientManager, objectId: string, signal: AbortSignal) {
  return http.json(withQuery(path + 'getjsonobject', { jsonObjectId: objectId }),
    detail.omit({ name: true, typeId: true, schemaId: true, parentId: true, content: true }).extend({
      objectName: text, jsonObjectTypeId: z.number().int(), jsonObjectTypeSchemaVersionId: z.number().int(),
      parentJsonObjectItemId: id.nullish(), objectContent: text,
    }).transform(({ objectName, jsonObjectTypeId, jsonObjectTypeSchemaVersionId, parentJsonObjectItemId, objectContent, ...rest }) =>
      ({ ...rest, name: objectName, typeId: jsonObjectTypeId, schemaId: jsonObjectTypeSchemaVersionId,
        parentId: parentJsonObjectItemId, content: objectContent })),
    { signal, exactIntegerFields: ['id', 'parentJsonObjectItemId', 'objectId'] });
}
export async function saveJsonObject(http: HttpClientManager, value: JsonObjectDetail) {
  const { id: objectId, name, typeId, schemaId, parentId, content, description, isActive, isDeleted } = value;
  const result = confirmCommand(await http.json(path + 'savejsonobject', commandWithData(id), {
    method: 'POST', exactIntegerFields: ['data'], body: { id: objectId, objectName: name, jsonObjectTypeId: typeId, jsonObjectTypeSchemaVersionId: schemaId,
      parentJsonObjectItemId: parentId, objectContent: content, description: description ?? '', isActive, isDeleted,
      objectId: value.objectId ?? '0', objectTypeId: value.objectTypeId ?? 0 },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}
export async function deleteJsonObject(http: HttpClientManager, objectId: string) {
  confirmCommand(await http.json(withQuery(path + 'deletejsonobject', { jsonObjectId: objectId }), genericResponse, { method: 'POST' }));
}
