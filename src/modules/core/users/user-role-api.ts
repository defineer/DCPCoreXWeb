import { z } from 'zod';
import type { RecordStatus } from '@/shared/contracts';
import type { HttpClientManager } from '@/shared/http';
import { membershipFields } from '../security/membership-contract';

const userRole = membershipFields.extend({ roleName: z.string().nullish() });
export type UserRole = z.infer<typeof userRole>;

export function getUserRoles(http: HttpClientManager, userId: number, status: RecordStatus, signal: AbortSignal) {
  return http.json('/api/userservice/getuserroles', z.array(userRole), {
    method: 'POST', modifying: false, signal, body: { userId, recordStatusQueryType: status },
  });
}
