import { useMemo, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { recordStatus, type RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { useTableExport } from '@/shared/ui/table-export-action';
import { toast } from '@/shared/ui/toasts';
import type { Membership } from './membership-contract';
import { deleteMembership, membershipOperations, type MembershipScope } from './membership-api';
import { MembershipEditor, type MembershipTarget } from './membership-editor';

export function MembershipList<T extends Membership>({ title, operation, load, name, scope: { kind, id } }: {
  title: string; operation: string; load: (status: RecordStatus, signal: AbortSignal) => Promise<T[]>;
  name: (row: T) => string | null | undefined; scope: MembershipScope;
}) {
  const { t, date, error } = useGlobalization();
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const confirm = useDialogManager();
  const scope = useMemo(() => ({ kind, id }), [kind, id]);
  const [selectedId, select] = useState<number>();
  const [target, setTarget] = useState<MembershipTarget>();
  const [busy, setBusy] = useState(false);
  const command = useRef(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const refresh = () => setReloadVersion(version => version + 1);
  const permission = membershipOperations[kind].permission;
  const listPage = 'Web' + operation;
  const editorPage = 'Web' + permission + 'Edit';
  const grant = (action: string) => canAction(listPage, 'Web' + action + permission);
  const canSave = canPage(editorPage) && canAction(editorPage, 'WebSave' + permission);
  const canNew = canSave && grant('Add');
  const canEdit = canSave && grant('Edit');
  const canView = canPage(editorPage) && grant('View');
  const core = (key: string) => t(key, undefined, 'Core');
  const yesNo = (value: boolean) => core(value ? 'Yes' : 'No');
  const columns = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => name(row) ?? '–' },
    { key: 'primary', title: core('Primary'), render: row => yesNo(row.isPrimary) },
    { key: 'start', title: core('StartDate'), render: row => date(row.startDate) },
    { key: 'end', title: core('EndDate'), render: row => date(row.endDate) },
    { key: 'active', title: core('Active'), render: row => yesNo(row.isActive) },
  ] satisfies Column<T>[];

  async function remove(row: T) {
    if (command.current || !grant('Delete')) return;
    command.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: name(row) || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteMembership(http, scope, row.id);
      select(undefined);
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
  return <>
    <RecordStatusResults title={title} operation={operation} load={load} reloadVersion={reloadVersion} actions={(rows, status) => {
      const row = rows.find(member => member.id === selectedId);
      return [
        { key: 'new', label: core('New'), icon: <WorkspaceIcon name="add" />,
          allowed: canNew, enabled: !busy, run: () => setTarget({ mode: 'new' }) },
        { key: 'edit', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'edit', id: row.id, name: name(row) }); } },
        { key: 'view', label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canView,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'view', id: row.id, name: name(row) }); } },
        exportAction(rows, !busy),
        { key: 'delete', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: grant('Delete'),
          enabled: Boolean(row) && !busy && status !== recordStatus.deleted,
          run: () => { if (row) return remove(row); } },
      ];
    }}>
      {rows => <DataTable label={title} columns={columns} rows={rows} rowId={row => row.id}
        selected={selectedId} onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {target && <MembershipEditor scope={scope} target={target} allowEdit={canEdit}
      allowed={target.mode === 'new' ? canNew : target.mode === 'edit' ? canEdit : canView}
      onSaved={refresh} onClose={() => setTarget(undefined)} />}
  </>;
}
