import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { exportTable, type ExportFormat } from '@/shared/export';
import { DataTable, ListPage, Pagination, type Sort } from '@/shared/ui/data-table';
import { Button, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar, type ToolbarAction } from '@/shared/ui/toolbar';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { toast } from '@/shared/ui/toasts';
import { deleteUser, getUsers, type RecordStatus, type UserListView } from './user-api';
import { UserEdit, type UserEditorTarget, type UserMode } from './user-edit';

const pageKey = 'WebUserList';
const userActions = { new: 'WebAddUser', edit: 'WebEditUser', view: 'WebViewUser' } as const;
const defaultSort: Sort = { key: 'Id', descending: false };

export function UserList() {
  const { http } = useSession();
  const workspace = useWorkspace();
  const { t, error } = useGlobalization();
  const dialog = useDialogManager();
  const navigate = useNavigate();
  const [status, setStatus] = useState<RecordStatus>(1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [selectedId, select] = useState<number>();
  const [editor, setEditor] = useState<UserEditorTarget>();
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
  const canEditPage = workspace.canPage('WebUserEdit');
  const allow = (key: string) => workspace.canAction(pageKey, key);
  const allowedExport = allow('WebExportUsers');
  const columns = [
    { key: 'Id', title: t('Id', undefined, 'Core'), render: (row: UserListView) => row.id, sortable: true, width: '7%', numeric: true },
    { key: 'UserName', title: t('UserName', undefined, 'Core'), render: (row: UserListView) => row.userName ?? '', sortable: true, width: '24%' },
    { key: 'NameSurname', title: t('Name', undefined, 'Core'), render: (row: UserListView) => row.nameSurname ?? '', sortable: true, width: '26.5%' },
    { key: 'Email', title: t('Field.Email'), render: (row: UserListView) => row.email ?? '', sortable: true },
  ];
  function open(mode: UserMode) {
    if (!canEditPage || !allow(userActions[mode]) || command.current || (mode !== 'new' && !selected)) return;
    setEditor({ mode, userId: mode === 'new' ? undefined : selected?.id });
  }
  function search() {
    if (command.current) return;
    select(undefined);
    if (page !== 1) setPage(1);
    else result.refresh();
  }
  async function remove() {
    if (!selected || !allow('WebDeleteUser') || command.current || status === 3) return;
    command.current = true;
    setBusy(true);
    try {
      if (!await dialog({ message: t('Common.DeleteConfirm', { name: selected.nameSurname ?? selected.userName ?? String(selected.id) }),
        accept: t('Delete', undefined, 'Core'), reject: t('Cancel', undefined, 'Core') })) return;
      if (!allow('WebDeleteUser')) return;
      await deleteUser(http, selected.id);
      select(undefined);
      toast.success(t('Common.Deleted'));
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else result.refresh();
    } catch (failure) { toast.error(error(failure, true)); }
    finally { command.current = false; setBusy(false); }
  }
  async function exportResults(format: ExportFormat) {
    if (!allow('WebExportUsers') || !rows.length || command.current) return;
    command.current = true;
    setBusy(true);
    try {
      await exportTable(format, 'users-page-' + page,
        [columns.map(column => column.title), ...rows.map(row => columns.map(column => column.render(row)))]);
    } catch (failure) { toast.error(error(failure)); }
    finally { command.current = false; setBusy(false); }
  }

  const tools: ToolbarAction[] = [
    { key: 'new', label: t('New', undefined, 'Core'), icon: <WorkspaceIcon name="add" />, allowed: canEditPage && allow('WebAddUser'), enabled: !busy, run: () => open('new') },
    { key: 'edit', label: t('Edit', undefined, 'Core'), icon: <WorkspaceIcon name="edit" />, allowed: canEditPage && allow('WebEditUser'), enabled: !!selected && !busy, run: () => open('edit') },
    { key: 'delete', label: t('Delete', undefined, 'Core'), icon: <WorkspaceIcon name="delete" />, allowed: allow('WebDeleteUser'), enabled: !!selected && !busy && status !== 3, run: remove },
    { key: 'view', label: t('View', undefined, 'Core'), icon: <WorkspaceIcon name="info" />, allowed: canEditPage && allow('WebViewUser'), enabled: !!selected && !busy, run: () => open('view') },
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
      <ListPage resultsTitle={t('Page.Users')} query={<form className="workspace-user-query workspace-fields" onSubmit={event => { event.preventDefault(); search(); }}>
        <SelectField label={t('User.RecordStatus')} value={status} disabled={busy}
          options={[
            { value: 0, label: t('Common.All') }, { value: 1, label: t('ActiveRecords', undefined, 'Core') },
            { value: 2, label: t('InActiveRecords', undefined, 'Core') }, { value: 3, label: t('Common.DeletedStatus') },
          ]}
          onChange={value => { setStatus(Number(value) as RecordStatus); setPage(1); select(undefined); }} />
        <Button type="submit" disabled={busy} aria-label={t('User.Search')} className="workspace-search"><WorkspaceIcon name="search" />{t('Search', undefined, 'Core')}</Button>
      </form>} tools={<Toolbar operation="UserList" actions={tools} />}>
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
  </Page>;
}
