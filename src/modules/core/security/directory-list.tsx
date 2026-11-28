import { useRef, useState } from 'react';
import { KeyRound, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useFormStateService } from '@/shared/forms';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { useGlobalization } from '@/shared/globalization';
import type { Column } from '@/shared/ui/data-table';
import { PagedDataTable } from '@/shared/ui/data-table';
import { Page } from '@/shared/ui/page';
import { Modal, WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { useTableExport } from '@/shared/ui/table-export-action';
import { TreeTable } from '@/shared/ui/tree-table';
import { toast } from '@/shared/ui/toasts';
import type { AccessModelScope } from '../access-models/access-model-api';
import { AccessModelTreeList } from '../access-models/access-model-tree-list';
import { MembershipList } from './membership-list';
import type { UserMembership } from './membership-contract';
import { DirectoryDetailDialog } from './directory-detail';
import type { DirectoryDetail } from './directory-contract';
import { DirectoryEditorDialog, type DirectoryEditorTarget } from './directory-editor';
import type { MembershipKind } from './membership-api';

type DirectoryRow = { id: number; isActive: boolean };
type RelatedView = 'users' | 'accessModels';

export function SecurityDirectoryList<T extends DirectoryRow>({ pageKey, operation, title, rowsTitle, name, load, loadUsers,
  usersPage, usersAction, memberKind, accessAction, accessScope, details, maintenance, parent }: {
  pageKey: string; operation: string; title: string; rowsTitle: string; name: (row: T) => string | null | undefined;
  load: (status: RecordStatus, signal: AbortSignal) => Promise<T[]>;
  loadUsers: (id: number, status: RecordStatus, signal: AbortSignal) => Promise<UserMembership[]>;
  usersPage: string; usersAction: string; accessAction: string; accessScope: (id: number) => AccessModelScope;
  memberKind: Exclude<MembershipKind, 'userRole'>;
  details: { page: string; grant: string; load: (id: number, signal: AbortSignal) => Promise<DirectoryDetail> };
  maintenance?: { noun: string; addAction: string; editAction: string; deleteAction: string; saveAction: string;
    save: (value: DirectoryDetail) => Promise<number>; remove: (id: number) => Promise<void>;
    canManage?: (row: T) => boolean;
    prepareParent?: (row: T | undefined) => Promise<DirectoryDetail['parent']> };
  parent?: { id: (row: T) => number; name: (row: T) => string | null | undefined };
}) {
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const { allowLeave } = useFormStateService();
  const { canAction, canPage } = useWorkspace();
  const navigate = useNavigate();
  const [selectedId, setSelected] = useState<number>();
  const [related, setRelated] = useState<{ kind: RelatedView; row: T }>();
  const [detail, setDetail] = useState<T>();
  const [editor, setEditor] = useState<DirectoryEditorTarget>();
  const [busy, setBusy] = useState(false);
  const command = useRef(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const core = (key: string) => t(key, undefined, 'Core');
  const columns: (Omit<Column<T>, 'render'> & { render: (row: T) => string | number })[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => name(row) || String(row.id) },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];
  if (parent) columns.splice(1, 0, { key: 'parent', title: core('Parent'), render: row => parent.name(row) || '–' });
  const users = canPage(usersPage) && canAction(pageKey, usersAction);
  const access = canPage('WebAccessModelTreeList') && canAction(pageKey, accessAction);
  const relatedTitle = related?.kind === 'users' ? core('Users') : core('AccessModels');
  const canView = canPage(details.page) && canAction(pageKey, details.grant);
  const canOpenEditor = canPage(details.page);
  const canSave = Boolean(maintenance && canAction(details.page, maintenance.saveAction));
  const canAdd = Boolean(maintenance && canOpenEditor && canAction(pageKey, maintenance.addAction));
  const canEdit = Boolean(maintenance && canOpenEditor && canAction(pageKey, maintenance.editAction));
  const canDelete = Boolean(maintenance && canAction(pageKey, maintenance.deleteAction));
  const refresh = () => setReloadVersion(version => version + 1);

  async function create(row: T | undefined) {
    if (!maintenance || !canAdd || command.current) return;
    command.current = true;
    setBusy(true);
    try {
      const parent = await maintenance.prepareParent?.(row);
      setEditor({ mode: 'new', initial: { id: 0, name: '', keyName: '', description: '', isActive: true, isDeleted: false, parent } });
    } catch (failure) {
      toast.error(error(failure));
    } finally {
      command.current = false;
      setBusy(false);
    }
  }

  async function remove(row: T) {
    if (!maintenance || !canDelete || command.current) return;
    command.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: name(row) || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await maintenance.remove(row.id);
      setSelected(undefined);
      refresh();
      toast.success(t('Common.Deleted'));
    } catch (failure) {
      toast.error(error(failure, true));
    } finally {
      command.current = false;
      setBusy(false);
    }
  }

  const exportAction = useTableExport<T>(operation, columns);
  return <Page id={operation} title={title}>
    <RecordStatusResults title={rowsTitle} operation={operation} load={load} reloadVersion={reloadVersion} actions={rows => {
      const row = rows.find(row => row.id === selectedId);
      const manageable = row && (maintenance?.canManage?.(row) ?? true);
      return [
        { key: 'new', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd, enabled: !busy,
          run: () => create(row) },
        { key: 'edit', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit, enabled: Boolean(manageable) && !busy,
          run: () => { if (row) setEditor({ mode: 'edit', id: row.id }); } },
        { key: 'delete', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete, enabled: Boolean(manageable) && !busy,
          run: () => { if (row) return remove(row); } },
        { key: details.grant, label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView,
          enabled: Boolean(row), run: () => { if (row) setDetail(row); } },
        { key: usersAction, label: core('Users'), icon: <UsersRound />, allowed: users, enabled: Boolean(row),
          run: () => { if (row) setRelated({ kind: 'users', row }); } },
        { key: accessAction, label: core('AccessModels'), icon: <KeyRound />, allowed: access, enabled: Boolean(row),
          run: () => { if (row) setRelated({ kind: 'accessModels', row }); } },
        exportAction(rows, !busy),
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ];
    }}>
      {rows => parent ? <TreeTable onPageChange={() => setSelected(undefined)} label={rowsTitle} columns={columns} rows={rows} rowId={row => row.id} parentId={parent.id}
        nameColumn="name" selected={selectedId} onSelect={row => setSelected(row.id)} />
        : <PagedDataTable onPageChange={() => setSelected(undefined)} label={rowsTitle} columns={columns} rows={rows} rowId={row => row.id}
          selected={selectedId} onSelect={row => setSelected(row.id)} resizable />}
    </RecordStatusResults>
    {editor && maintenance && <DirectoryEditorDialog target={editor} noun={maintenance.noun} allowNew={canAdd}
      allowEdit={canEdit} canSave={canSave} load={details.load} save={maintenance.save} onSaved={refresh} onClose={() => setEditor(undefined)} />}
    {detail && canView && <DirectoryDetailDialog title={name(detail) || String(detail.id)} id={detail.id}
      load={details.load} onClose={() => setDetail(undefined)} />}
    {related && (related.kind === 'users' ? users : access) && <Modal
      title={(name(related.row) || String(related.row.id)) + ' - ' + relatedTitle} workspace onClose={() => {
        void allowLeave().then(allowed => { if (allowed) setRelated(undefined); });
      }}>
      {related.kind === 'users'
        ? <MembershipList<UserMembership> title={relatedTitle} operation={usersPage.slice(3)} name={row => row.userName}
          scope={{ kind: memberKind, id: related.row.id }}
          load={(status, signal) => loadUsers(related.row.id, status, signal)} />
        : <AccessModelTreeList scope={accessScope(related.row.id)} />}
    </Modal>}
  </Page>;
}
