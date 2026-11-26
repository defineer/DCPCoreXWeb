import { useCallback } from 'react';
import { useSession } from '@/app/session';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { MembershipList } from '../security/membership-list';
import { getUserRoles, type UserRole } from './user-role-api';

export function UserRolesList({ userId }: { userId: number }) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getUserRoles(http, userId, status, signal), [http, userId]);
  return <MembershipList<UserRole> title={t('Roles', undefined, 'Core')} operation="UserRolesList" load={load}
    scope={{ kind: 'userRole', id: userId }} name={row => row.roleName} />;
}
