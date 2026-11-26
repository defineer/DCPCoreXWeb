import { useCallback } from 'react';
import { useSession } from '@/app/session';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { ApiFailure } from '@/shared/http';
import { SecurityDirectoryList } from '../security/directory-list';
import { deleteWorkgroup, getWorkgroup, getWorkgroups, getWorkgroupUsers, hasRootWorkgroup, saveWorkgroup } from './workgroup-api';

export function WorkgroupTreeList() {
  const { http } = useSession();
  const { t } = useGlobalization();
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getWorkgroups(http, status, signal), [http]);
  return <SecurityDirectoryList pageKey="WebWorkgroupTreeList" operation="WorkgroupTreeList" title={t('Workgroup.Management')}
    rowsTitle={t('Workgroups', undefined, 'Core')} name={row => row.workgroupName} load={load}
    loadUsers={(id, status, signal) => getWorkgroupUsers(http, id, status, signal)}
    usersPage="WebWorkgroupUsersList" usersAction="WebListWorkgroupUsers" memberKind="workgroupUser" accessAction="WebListWorkgroupAccessModels"
    details={{ page: 'WebWorkgroupEdit', grant: 'WebViewWorkgroup', load: (id, signal) => getWorkgroup(http, id, signal) }}
    maintenance={{ noun: t('Workgroup', undefined, 'Core'), addAction: 'WebAddWorkgroup', editAction: 'WebEditWorkgroup',
      deleteAction: 'WebDeleteWorkgroup', saveAction: 'WebSaveWorkgroup', save: value => saveWorkgroup(http, value),
      remove: id => deleteWorkgroup(http, id),
      prepareParent: async row => {
        if (row?.isActive) return { id: row.id, name: row.workgroupName };
        if (row || await hasRootWorkgroup(http)) throw new ApiFailure('command', 0, { message: t('Workgroup.SelectParent') });
        return { id: null, name: null };
      } }}
    accessScope={workgroupId => ({ workgroupId })}
    parent={{ id: row => row.parentWorkgroupId ?? 0, name: row => row.parentWorkgroupName }} />;
}
