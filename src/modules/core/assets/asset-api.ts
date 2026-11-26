import { z } from 'zod';
import { commandWithData, genericResponse, simpleData, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const path = '/api/assetservice/';
const id = z.string().regex(/^[1-9]\d*$/);
const text = z.string().nullish();
const assetRow = z.object({ id, identifier: text, assetName: text, assetTypeName: text });
const assetDetail = assetRow.omit({ assetTypeName: true }).extend({
  assetTypeId: z.number().int(), features: text, description: text,
  isActive: z.boolean(), isDeleted: z.boolean(), insertedBy: z.number().int().nullish(),
  insertedDate: text, updatedBy: z.number().int().nullish(), updatedDate: text,
});
export type AssetRow = z.infer<typeof assetRow>;
export type AssetDetail = z.infer<typeof assetDetail>;
const assetType = simpleData.extend({ isActive: z.boolean() });
export type AssetType = z.infer<typeof assetType>;

export function getAssets(http: HttpClientManager, status: RecordStatus, type: number, signal: AbortSignal) {
  return http.json(path + 'getassets', z.array(assetRow), {
    method: 'POST', modifying: false, body: { recordStatusQueryType: status, assetType: type }, signal,
  });
}

export function getAssetTypes(http: HttpClientManager, signal: AbortSignal) {
  return http.json(path + 'getassettypessimple', z.array(assetType), { signal });
}

export function getAsset(http: HttpClientManager, id: string, signal: AbortSignal) {
  return http.json(withQuery(path + 'getasset', { assetId: id }), assetDetail, { signal });
}

export async function saveAsset(http: HttpClientManager, detail: AssetDetail) {
  const { id: assetId, identifier, assetName, assetTypeId, features, description, isActive, isDeleted } = detail;
  const result = confirmCommand(await http.json(path + 'saveasset', commandWithData(id), {
    method: 'POST', body: { id: assetId, identifier, assetName, assetTypeId, features, description, isActive, isDeleted },
  }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteAsset(http: HttpClientManager, id: string) {
  confirmCommand(await http.json(withQuery(path + 'deleteasset', { assetId: id }), genericResponse, { method: 'POST' }));
}

const countRow = z.object({ name: z.string(), count: z.number().int().nonnegative() });
export type AssetTypeCount = z.infer<typeof countRow>;

export function getAssetTypeCounts(http: HttpClientManager, range: { localStartDate: string; localEndDate: string } | undefined,
  signal: AbortSignal) {
  const endpoint = path + 'getassettypescount';
  return http.json(range ? withQuery(endpoint, range) : endpoint, z.array(countRow), { signal });
}
