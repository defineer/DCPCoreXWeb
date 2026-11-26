import { z } from 'zod';
import { commandWithData, genericResponse, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';
import { userMembership } from '../security/membership-contract';
import { directoryDetail, type DirectoryDetail } from '../security/directory-contract';

const role = z.object({
  id: z.number().int().positive(), roleName: z.string().nullish(), isActive: z.boolean(), canManage: z.boolean().optional(),
});

export function getRoles(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/roleservice/getroles', z.array(role), {
    method: 'POST', modifying: false, signal, body: { recordStatusQueryType: status },
  });
}

export function getRoleUsers(http: HttpClientManager, roleId: number, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/roleservice/getroleusers', z.array(userMembership), {
    method: 'POST', modifying: false, signal, body: { recordStatusQueryType: status, roleId },
  });
}

const roleDetails = directoryDetail.extend({ roleName: z.string().nullish() });
export async function getRole(http: HttpClientManager, roleId: number, signal: AbortSignal) {
  const detail = await http.json(withQuery('/api/roleservice/getrole', { roleId }), roleDetails, { signal });
  return { ...detail, name: detail.roleName };
}

export async function saveRole(http: HttpClientManager, value: DirectoryDetail) {
  const { id, name, keyName, description, isActive, isDeleted } = value;
  const response = confirmCommand(await http.json('/api/roleservice/saverole',
    commandWithData(z.number().int().positive()), { method: 'POST',
      body: { id, roleName: name, keyName, description, isActive, isDeleted } }));
  if (!response.data) throw new ApiFailure('invalid-response');
  return response.data;
}

export async function deleteRole(http: HttpClientManager, roleId: number) {
  confirmCommand(await http.json(withQuery('/api/roleservice/deleterole', { roleId }), genericResponse, { method: 'POST' }));
}
