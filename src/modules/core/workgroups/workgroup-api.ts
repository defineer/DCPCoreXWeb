import { z } from 'zod';
import { commandWithData, genericResponse, type RecordStatus } from '@/shared/contracts';
import { ApiFailure, confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';
import { userMembership } from '../security/membership-contract';
import { directoryDetail, type DirectoryDetail } from '../security/directory-contract';

const workgroup = z.object({
  id: z.number().int().positive(), parentWorkgroupId: z.number().int().nonnegative().nullish(),
  workgroupName: z.string().nullish(), parentWorkgroupName: z.string().nullish(), isActive: z.boolean(),
});

export function getWorkgroups(http: HttpClientManager, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/workgroupservice/getworkgroups', z.array(workgroup), {
    method: 'POST', modifying: false, signal, body: { recordStatusQueryType: status },
  });
}

export function getWorkgroupUsers(http: HttpClientManager, workgroupId: number, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/workgroupservice/getworkgroupusers', z.array(userMembership), {
    method: 'POST', modifying: false, signal, body: { recordStatusQueryType: status, workgroupId },
  });
}

export async function getWorkgroup(http: HttpClientManager, workgroupId: number, signal: AbortSignal) {
  const detail = await http.json(withQuery('/api/workgroupservice/getworkgroup', { workgroupId }),
    directoryDetail.extend(workgroup.shape), { signal });
  return { ...detail, name: detail.workgroupName, parent: { id: detail.parentWorkgroupId, name: detail.parentWorkgroupName } };
}

export function hasRootWorkgroup(http: HttpClientManager) {
  return http.json('/api/workgroupservice/hasrootworkgroup', z.boolean(), {});
}

export async function saveWorkgroup(http: HttpClientManager, value: DirectoryDetail) {
  const { id, name, keyName, description, isActive, isDeleted, parent } = value;
  const response = confirmCommand(await http.json('/api/workgroupservice/saveworkgroup', commandWithData(z.number().int().positive()), {
    method: 'POST', body: { id, workgroupName: name, keyName, description, isActive, isDeleted,
      parentWorkgroupId: parent?.id ?? null },
  }));
  if (!response.data) throw new ApiFailure('invalid-response');
  return response.data;
}

export async function deleteWorkgroup(http: HttpClientManager, workgroupId: number) {
  confirmCommand(await http.json(withQuery('/api/workgroupservice/deleteworkgroup', { workgroupId }), genericResponse, { method: 'POST' }));
}
