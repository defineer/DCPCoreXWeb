import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { KeyRound, UsersRound } from 'lucide-react';
import { recordStatus, type RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { exportTable, type ExportFormat } from '@/shared/export';
import { DataTable, ListPage, Pagination, type Sort } from '@/shared/ui/data-table';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusQuery } from '@/shared/ui/record-status-query';
import { Toolbar, type ToolbarAction } from '@/shared/ui/toolbar';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { toast } from '@/shared/ui/toasts';
import { deleteUser, getUsers, type UserListView } from './user-api';
import { UserEdit, type UserEditorTarget, type UserMode } from './user-edit';
import { userActions, userPages, userRelatedPages, type UserRelatedPage } from './user-permissions';
import { UserRelatedDialog, type UserRelatedTarget } from './user-related-dialog';

const defaultSort: Sort = { key: 'Id', descending: false };
const relatedIcons = { roles: UsersRound, accessModels: KeyRound };

export function UserList() {
  const { http } = useSession();
  const workspace = useWorkspace();
  const { t, error } = useGlobalization();
  const dialog = useDialogManager();
  const navigate = useNavigate();
  const [status, setStatus] = useState<RecordStatus>(recordStatus.active);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [selectedId, select] = useState<number>();
  const [editor, setEditor] = useState<UserEditorTarget>();
  const [related, setRelated] = useState<UserRelatedTarget>();
  const [busy, setBusy] = useState(false);
  const command = useRef(false);
  const pageSize = Math.min(60, Math.max(10, workspace.preferences?.rowsPerPage ?? 20));
  const load = useCallback((signal: AbortSignal) => getUsers(http, {
    recordStatusQueryType: status,
    dataFilter: { page, pageSize, sortColumn: sort.key, isDescending: sort.descending },
  }, signal), [http, status, page, pageSize, sort]);
  const result = useResource(load);
  const rows = result.state === 'ready' ? result.data.data : [];
  const selected = rows.find(row => row.id === selectedId);
  const canEditPage = workspace.canPage(userPages.editor);
  const allow = (key: string) => workspace.canAction(userPages.list, key);
  const allowedExport = allow(userActions.export);
  const columns = [
    { key: 'Id', title: t('Id', undefined, 'Core'), render: (row: UserListView) => row.id, sortable: true, width: '7%', numeric: true },
    { key: 'UserName', title: t('UserName', undefined, 'Core'), render: (row: UserListView) => row.userName ?? '', sortable: true, width: '24%' },
    { key: 'NameSurname', title: t('Name', undefined, 'Core'), render: (row: UserListView) => row.nameSurname ?? '', sortable: true, width: '26.5%' },
    { key: 'Email', title: t('Field.Email'), render: (row: UserListView) => row.email ?? '', sortable: true },
  ];
  function open(mode: UserMode) {
    if (!canEditPage || !allow(userActions[mode]) || command.current) return;
    if (mode === 'new') setEditor({ mode });
    else if (selected) setEditor({ mode, userId: selected.id });
  }
  function search() {
    if (command.current) return;
    select(undefined);
    if (page !== 1) setPage(1);
    else result.refresh();
  }
  async function remove() {
    if (!selected || !allow(userActions.delete) || command.current || status === recordStatus.deleted) return;
    command.current = true;
    setBusy(true);
    try {
      if (!await dialog({ message: t('Common.DeleteConfirm', { name: selected.nameSurname ?? selected.userName ?? String(selected.id) }),
        accept: t('Delete', undefined, 'Core'), reject: t('Cancel', undefined, 'Core') })) return;
      await deleteUser(http, selected.id);
      select(undefined);
      toast.success(t('Common.Deleted'));
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else result.refresh();
    } catch (failure) { toast.error(error(failure, true)); }
    finally { command.current = false; setBusy(false); }
  }
  async function exportResults(format: ExportFormat) {
    if (!allowedExport || !rows.length || command.current) return;
    command.current = true;
    setBusy(true);
    try {
      await exportTable(format, 'users-page-' + page,
        [columns.map(column => column.title), ...rows.map(row => columns.map(column => column.render(row)))]);
    } catch (failure) { toast.error(error(failure)); }
    finally { command.current = false; setBusy(false); }
  }

  const tools: ToolbarAction[] = [
    { key: 'new', label: t('New', undefined, 'Core'), icon: <WorkspaceIcon name="add" />, allowed: canEditPage && allow(userActions.new), enabled: !busy, run: () => open('new') },
    { key: 'edit', label: t('Edit', undefined, 'Core'), icon: <WorkspaceIcon name="edit" />, allowed: canEditPage && allow(userActions.edit), enabled: !!selected && !busy, run: () => open('edit') },
    { key: 'delete', label: t('Delete', undefined, 'Core'), icon: <WorkspaceIcon name="delete" />, allowed: allow(userActions.delete), enabled: !!selected && !busy && status !== recordStatus.deleted, run: remove },
    { key: 'view', label: t('View', undefined, 'Core'), icon: <WorkspaceIcon name="info" />, allowed: canEditPage && allow(userActions.view), enabled: !!selected && !busy, run: () => open('view') },
    ...(['roles', 'accessModels'] as const).map((kind: UserRelatedPage) => {
      const relatedPage = userRelatedPages[kind];
      const Icon = relatedIcons[kind];
      const allowed = workspace.canPage(relatedPage.page) && allow(relatedPage.action);
      return { key: relatedPage.action, label: t(relatedPage.label, undefined, 'Core'), icon: <Icon />,
        allowed, enabled: !!selected && !busy, run: () => {
          if (selected && allowed && !command.current) setRelated({ kind, user: selected });
        } };
    }),
    { key: 'export', label: t('Export', undefined, 'Core'), accessibleLabel: t('Common.Export'), icon: <WorkspaceIcon name="export" />, allowed: allowedExport, enabled: rows.length > 0 && !busy,
      actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: () => exportResults(format) })) },
    { key: 'refresh', label: t('Refresh', undefined, 'Core'), icon: <WorkspaceIcon name="arrow-sync" />, enabled: !busy, run: result.refresh },
    { key: 'close', label: t('Close', undefined, 'Core'), icon: <WorkspaceIcon name="back" />, enabled: !busy, run: () => navigate('/index') },
  ];
  const pagerPosition = workspace.preferences?.gridPagerPosition;
  const displayed = result.state === 'ready' ? result.data : result.state === 'loading' ? result.previousData : undefined;
  const pager = displayed && <Pagination page={page} pageSize={pageSize} total={displayed.totalRecords}
    onPage={next => { if (!command.current) { setPage(next); select(undefined); } }} />;

  return <Page id="UserList" title={t('User.ListTitle')}>
    <LoadingRegion loading={result.state === 'loading'}>
      <ListPage resultsTitle={t('Page.Users')} query={<RecordStatusQuery value={status} disabled={busy}
        searchLabel={t('User.Search')} onSearch={search}
        onChange={value => { setStatus(value); setPage(1); select(undefined); }} />}
        tools={<Toolbar operation="UserList" actions={tools} />}>
        {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
        {result.state !== 'error' && <>
          {(pagerPosition === 'Top' || pagerPosition === 'TopAndBottom') && pager}
          <DataTable label={t('Page.Users')} rows={displayed?.data ?? []} columns={columns} rowId={row => row.id} selected={selectedId} resizable
            onSelect={row => { if (!command.current) select(row.id); }} sort={sort}
            onSort={value => { if (!command.current) { setSort(value); setPage(1); select(undefined); } }} />
          {pagerPosition !== 'Top' && pager}
        </>}
      </ListPage>
    </LoadingRegion>
    {editor && <UserEdit target={editor} onClose={() => setEditor(undefined)} onSaved={() => result.refresh()} />}
    {related && <UserRelatedDialog target={related} onClose={() => setRelated(undefined)} />}
  </Page>;
}
