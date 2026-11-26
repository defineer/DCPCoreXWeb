import { useCallback, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { Page, StatusPanel } from '@/shared/ui/page';
import type { AccessModelScope } from '../access-models/access-model-api';
import { AccessModelTreeList } from '../access-models/access-model-tree-list';
import { getRoleUsers } from '../roles/role-api';
import { UserRolesList } from '../users/user-roles-list';
import { getWorkgroupUsers } from '../workgroups/workgroup-api';
import { MembershipList } from './membership-list';
import type { UserMembership } from './membership-contract';

const principal = {
  userId: { page: 'WebUserList', path: '/userlistpage', label: 'User.Management', access: 'WebListUserAccessModels' },
  roleId: { page: 'WebRoleList', path: '/rolelistpage', label: 'Role.Management', access: 'WebListRoleAccessModels' },
  workgroupId: { page: 'WebWorkgroupTreeList', path: '/workgrouptreelistpage', label: 'Workgroup.Management',
    access: 'WebListWorkgroupAccessModels' },
} as const;
type Principal = keyof typeof principal;

function readId(params: URLSearchParams, key: Principal) {
  const values = params.getAll(key);
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return undefined;
  const id = Number(values[0]);
  return id <= 2147483647 ? id : undefined;
}

function ScopedPage({ kind, title, id, from, action, children }: {
  kind: string; title: string; id?: number; from: Principal; action: string; children: ReactNode;
}) {
  const { canAction } = useWorkspace();
  const { t } = useGlobalization();
  const parent = principal[from];
  const authorized = canAction(parent.page, action);
  return <Page id={kind} title={title}>
    {authorized && <Link className="text-primary underline" to={parent.path}>{t(parent.label)}</Link>}
    {authorized && id ? children : <StatusPanel kind={authorized ? 'missing' : 'denied'} />}
  </Page>;
}

export function UserRolesPage() {
  const [params] = useSearchParams();
  const { t } = useGlobalization();
  const id = readId(params, 'userId');
  return <ScopedPage kind="UserRolesList" title={t('Roles', undefined, 'Core')} id={id} from="userId" action="WebListUserRoles">
    {id && <UserRolesList key={id} userId={id} />}
  </ScopedPage>;
}

export function AccessModelsPage() {
  const [params] = useSearchParams();
  const { t } = useGlobalization();
  const selected = (Object.keys(principal) as Principal[]).filter(key => params.has(key));
  const from = selected[0] ?? 'userId';
  const id = selected.length === 1 ? readId(params, from) : undefined;
  const scope: AccessModelScope | undefined = id === undefined ? undefined : from === 'userId'
    ? { userId: id } : from === 'roleId' ? { roleId: id } : { workgroupId: id };
  return <ScopedPage kind="AccessModelTreeList" title={t('AccessModels', undefined, 'Core')} id={id}
    from={from} action={principal[from].access}>
    {scope && <AccessModelTreeList key={from + ':' + id} scope={scope} />}
  </ScopedPage>;
}

function MemberUsersPage({ from }: { from: 'roleId' | 'workgroupId' }) {
  const [params] = useSearchParams();
  const { http } = useSession();
  const { t } = useGlobalization();
  const id = readId(params, from);
  const role = from === 'roleId';
  const operation = role ? 'RoleUsersList' : 'WorkgroupUsersList';
  const title = t('Users', undefined, 'Core');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => {
    if (!id) throw new Error('Missing principal identifier');
    return (role ? getRoleUsers : getWorkgroupUsers)(http, id, status, signal);
  }, [http, id, role]);
  return <ScopedPage kind={operation} title={title} id={id} from={from} action={role ? 'WebListRoleUsers' : 'WebListWorkgroupUsers'}>
    {id && <MembershipList<UserMembership> key={id} title={title} operation={operation}
      scope={{ kind: role ? 'roleUser' : 'workgroupUser', id }} name={row => row.userName} load={load} />}
  </ScopedPage>;
}

export function RoleUsersPage() { return <MemberUsersPage from="roleId" />; }
export function WorkgroupUsersPage() { return <MemberUsersPage from="workgroupId" />; }
