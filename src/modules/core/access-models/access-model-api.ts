import { z } from 'zod';
import { genericResponse, type RecordStatus } from '@/shared/contracts';
import { confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

export const accessRightValues = ['None', 'Execute', 'ReadOnly', 'Write'] as const;

const accessModel = z.object({
  id: z.number().int().positive(),
  accessModelId: z.number().int().nonnegative(),
  parentConfigurationElementId: z.number().int().nonnegative(),
  elementName: z.string().nullish(),
  configurationElementTypeName: z.string().nullish(),
  checked: z.boolean(),
  isActive: z.boolean(),
  isDeleted: z.boolean(),
  hasMultipleGrants: z.boolean().optional(),
  equivalentGrantIds: z.array(z.number().int().positive()).nullish(),
  grantChoices: z.array(z.object({ id: z.number().int().positive(), accessRight: z.number().int().min(0).max(3),
    isActive: z.boolean(), isDeleted: z.boolean() })).nullish(),
  accessRight: z.union([z.enum(accessRightValues), z.number().int().min(0).max(3)]),
});
const accessModelDetail = accessModel.pick({ isActive: true, isDeleted: true }).extend({
  id: z.number().int().positive(), insertedBy: z.number().int().nullish(), insertedDate: z.string().nullish(),
  updatedBy: z.number().int().nullish(), updatedDate: z.string().nullish(),
});
export type AccessModel = z.infer<typeof accessModel>;
export type AccessModelDetail = z.infer<typeof accessModelDetail>;
export type AccessModelScope = { userId: number } | { roleId: number } | { workgroupId: number };
export interface AccessModelChange {
  elementId: number; grantId: number; expectedAccessRight: number; expectedIsActive: boolean; expectedIsDeleted: boolean;
  isActive: boolean; isDeleted: boolean;
}

export function getAccessModels(http: HttpClientManager, scope: AccessModelScope, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/accessservice/getaccessmodels', z.array(accessModel), {
    method: 'POST', modifying: false, signal, body: { ...scope, recordStatusQueryType: status },
  });
}

export function getAccessModel(http: HttpClientManager, scope: AccessModelScope, row: AccessModel, signal: AbortSignal) {
  return http.json(withQuery('/api/accessservice/getaccessmodel', {
    ...scope, accessModelId: row.accessModelId, elementId: row.id,
  }), accessModelDetail, { signal });
}

export function accessModelChange(row: AccessModel, status: Pick<AccessModel, 'isActive' | 'isDeleted'>): AccessModelChange {
  return { elementId: row.id, grantId: row.accessModelId,
    expectedAccessRight: typeof row.accessRight === 'number' ? row.accessRight : accessRightValues.indexOf(row.accessRight),
    expectedIsActive: row.isActive, expectedIsDeleted: row.isDeleted, isActive: status.isActive, isDeleted: status.isDeleted };
}

export async function saveAccessModels(http: HttpClientManager, scope: AccessModelScope, changes: AccessModelChange[], single = false,
  equivalentGrantIds?: number[]) {
  const path = '/api/accessservice/savewebaccessmodels';
  confirmCommand(await http.json(single ? withQuery(path, { single: 'true' }) : path, genericResponse, {
    method: 'POST', body: { scope, changes, equivalentGrantIds },
  }));
}
