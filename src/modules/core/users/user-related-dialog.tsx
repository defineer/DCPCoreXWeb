import { useWorkspace } from '@/app/workspace';
import { useGlobalization } from '@/shared/globalization';
import { useFormStateService } from '@/shared/forms';
import { StatusPanel } from '@/shared/ui/page';
import { Modal } from '@/shared/ui/primitives';
import { AccessModelTreeList } from '../access-models/access-model-tree-list';
import type { UserListView } from './user-api';
import { userPages, userRelatedPages, type UserRelatedPage } from './user-permissions';
import { UserRolesList } from './user-roles-list';

export interface UserRelatedTarget {
  kind: UserRelatedPage;
  user: Pick<UserListView, 'id' | 'nameSurname' | 'userName'>;
}

export function UserRelatedDialog({ target, onClose }: { target: UserRelatedTarget; onClose: () => void }) {
  const { t } = useGlobalization();
  const { allowLeave } = useFormStateService();
  const { canPage, canAction } = useWorkspace();
  const page = userRelatedPages[target.kind];
  const { id, nameSurname, userName } = target.user;
  const label = t(page.label, undefined, 'Core');
  const name = nameSurname?.trim() || userName?.trim() || String(id);
  const authorized = canPage(page.page) && canAction(userPages.list, page.action);
  return <Modal title={authorized ? `${name} - ${label}` : label} workspace onClose={() => {
    void allowLeave().then(allowed => { if (allowed) onClose(); });
  }}>
    {authorized ? target.kind === 'roles' ? <UserRolesList key={id} userId={id} />
      : <AccessModelTreeList key={id} scope={{ userId: id }} /> : <StatusPanel kind="denied" />}
  </Modal>;
}
