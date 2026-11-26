import { z } from 'zod';
import { commandWithData, genericResponse, simpleData } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

export const membershipOperations = {
  userRole: { path: '/api/userservice/', stem: 'userrole', itemKey: 'userRoleId',
    parentKey: 'userId', selectedKey: 'roleId', choices: 'getusernotassignedroles', permission: 'UserRole', hasPrimary: true },
  roleUser: { path: '/api/roleservice/', stem: 'roleuser', itemKey: 'roleUserId',
    parentKey: 'roleId', selectedKey: 'userId', choices: 'getrolenotassignedusers', permission: 'RoleUser', hasPrimary: false },
  workgroupUser: { path: '/api/workgroupservice/', stem: 'workgroupuser', itemKey: 'workgroupUserId',
    parentKey: 'workgroupId', selectedKey: 'userId', choices: 'getworkgroupnotassignedusers', permission: 'WorkgroupUser', hasPrimary: true },
} as const;

export type MembershipKind = keyof typeof membershipOperations;
export interface MembershipScope { kind: MembershipKind; id: number }

const memberDetail = z.object({
  id: z.number().int().positive(), userId: z.number().int().positive(),
  roleId: z.number().int().positive().optional(), workgroupId: z.number().int().positive().optional(),
  startDate: z.string(), endDate: z.string().nullish(),
  startDateWithOffset: z.string().nullish(), endDateWithOffset: z.string().nullish(),
  isPrimary: z.boolean().optional(), isActive: z.boolean(), isDeleted: z.boolean(),
  insertedBy: z.number().int().nullish(), insertedDate: z.string().nullish(),
  updatedBy: z.number().int().nullish(), updatedDate: z.string().nullish(),
});

export type MembershipDetail = z.infer<typeof memberDetail>;
export interface MembershipSave {
  id: number; counterpartId: number; start: string; end: string | null;
  isPrimary: boolean; isActive: boolean; isDeleted: boolean;
}

export async function getMembership(http: HttpClientManager, scope: MembershipScope, id: number, signal: AbortSignal) {
  const operation = membershipOperations[scope.kind];
  const result = await http.json(withQuery(operation.path + 'get' + operation.stem, { [operation.itemKey]: id, scopeId: scope.id }),
    memberDetail, { signal });
  if (result.id !== id || result[operation.parentKey] !== scope.id || !result[operation.selectedKey])
    throw new ApiFailure('invalid-response');
  return result;
}

export function membershipChoices(http: HttpClientManager, scope: MembershipScope, signal: AbortSignal) {
  const operation = membershipOperations[scope.kind];
  return http.json(withQuery(operation.path + operation.choices, { [operation.parentKey]: scope.id }),
    z.array(simpleData), { signal });
}

export async function saveMembership(http: HttpClientManager, scope: MembershipScope, value: MembershipSave) {
  const operation = membershipOperations[scope.kind];
  const body = {
    id: value.id, [operation.parentKey]: scope.id, [operation.selectedKey]: value.counterpartId,
    isActive: value.isActive, isDeleted: value.isDeleted,
    ...(operation.hasPrimary && { isPrimary: value.isPrimary }),
    useEditorDateOffsets: true, startDateWithOffset: value.start, endDateWithOffset: value.end,
  };
  const result = confirmCommand(await http.json(withQuery(operation.path + 'save' + operation.stem, { scopeId: scope.id }),
    commandWithData(z.number().int().positive()), { method: 'POST', body }));
  if (!result.data) throw new ApiFailure('invalid-response');
  return result.data;
}

export async function deleteMembership(http: HttpClientManager, scope: MembershipScope, id: number) {
  const operation = membershipOperations[scope.kind];
  confirmCommand(await http.json(withQuery(operation.path + 'delete' + operation.stem, {
    [operation.itemKey]: id, scopeId: scope.id,
  }), genericResponse, { method: 'POST' }));
}
