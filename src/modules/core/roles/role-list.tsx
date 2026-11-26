import { useCallback } from 'react';
import { useSession } from '@/app/session';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { SecurityDirectoryList } from '../security/directory-list';
import { deleteRole, getRole, getRoles, getRoleUsers, saveRole } from './role-api';

export function RoleList() {
  const { http } = useSession();
  const { t } = useGlobalization();
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getRoles(http, status, signal), [http]);
  return <SecurityDirectoryList pageKey="WebRoleList" operation="RoleList" title={t('Role.Management')}
    rowsTitle={t('Roles', undefined, 'Core')} name={row => row.roleName} load={load}
    loadUsers={(id, status, signal) => getRoleUsers(http, id, status, signal)}
    usersPage="WebRoleUsersList" usersAction="WebListRoleUsers" memberKind="roleUser" accessAction="WebListRoleAccessModels"
    details={{ page: 'WebRoleEdit', grant: 'WebViewRole', load: (id, signal) => getRole(http, id, signal) }}
    maintenance={{ noun: t('Role', undefined, 'Core'), addAction: 'WebAddRole', editAction: 'WebEditRole',
      deleteAction: 'WebDeleteRole', saveAction: 'WebSaveRole', save: value => saveRole(http, value), remove: id => deleteRole(http, id),
      canManage: row => row.canManage !== false }}
    accessScope={roleId => ({ roleId })} />;
}
