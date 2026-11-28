import { useRef, useState, type ReactNode } from 'react';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { toast } from '@/shared/ui/toasts';
import { TreeTable } from '@/shared/ui/tree-table';

type CatalogTarget<T> = { mode: 'new'; parent?: T } | { mode: 'edit' | 'view'; row: T };
export type CatalogColumn<T> = Omit<Column<T>, 'render'> & { render: (row: T) => string | number };

export function CatalogList<T extends { id: number }>({ title, subject, filename, columns, name, load, allowAdd = true,
  onRemove, onClose, renderEditor, related, editorPage, saveAction, requiresParent, treeParent, filters }: {
  title: string; subject: string; filename: string; columns: CatalogColumn<T>[];
  name: (row: T) => string; load: (status: RecordStatus, signal: AbortSignal) => Promise<T[]>;
  allowAdd?: boolean; onRemove: (row: T) => Promise<void>; onClose?: () => void;
  renderEditor: (target: CatalogTarget<T>, canEdit: boolean, close: () => void, refresh: () => void) => ReactNode;
  related?: { open: (row: T) => void; key: string; label: string; icon: ReactNode };
  editorPage?: string; saveAction?: string; requiresParent?: (row: T) => boolean;
  treeParent?: (row: T) => number; filters?: ReactNode;
}) {
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const [selection, select] = useState<number>();
  const [target, setTarget] = useState<CatalogTarget<T>>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const page = 'Web' + subject + 'List';
  const editor = editorPage ?? 'Web' + subject + 'Edit';
  const permitted = (verb: string) => canAction(page, 'Web' + verb + subject);
  const canSave = canPage(editor) && canAction(editor, saveAction ?? 'WebSave' + subject);
  const canAdd = canSave && permitted('Add') && allowAdd;
  const canEdit = canSave && permitted('Edit');
  const canView = canPage(editor) && permitted('View');
  const canDelete = permitted('Delete');
  const refresh = () => setReload(version => version + 1);

  async function remove(row: T) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: name(row) }), accept: core('Delete'),
        reject: core('Cancel') })) return;
      await onRemove(row);
      select(undefined);
      toast.success(t('Common.Deleted'));
      refresh();
    } catch (failure) {
      toast.error(error(failure, true));
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  }

  const allowed = target && (target.mode === 'new' ? canAdd : target.mode === 'edit' ? canEdit : canView);
  return <>
    <RecordStatusResults title={title} operation={subject + 'List'} load={load} reloadVersion={reload} filters={filters}
      actions={rows => {
        const row = rows.find(item => item.id === selection);
        const enabled = Boolean(row) && !busy;
        const canUseParent = !requiresParent || (row !== undefined && requiresParent(row));
        return [
          { key: 'WebAdd' + subject, label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
            enabled: !busy && canUseParent, run: () => setTarget({ mode: 'new', parent: row }) },
          { key: 'WebEdit' + subject, label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
            enabled, run: () => { if (row) setTarget({ mode: 'edit', row }); } },
          { key: 'WebDelete' + subject, label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
            enabled, run: () => row && remove(row) },
          { key: 'WebView' + subject, label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView,
            enabled, run: () => { if (row) setTarget({ mode: 'view', row }); } },
          ...(related ? [{ key: related.key, label: related.label, icon: related.icon,
            enabled, run: () => { if (row) related.open(row); } }] : []),
          { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0 && !busy,
            actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
              try {
                await exportTable(format, filename, [columns.map(column => column.title),
                  ...rows.map(item => columns.map(column => column.render(item)))]);
              } catch (failure) { toast.error(error(failure)); }
            } })) },
          ...(onClose ? [{ key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: onClose }] : []),
        ];
      }}>
      {rows => treeParent
        ? <TreeTable label={title} rows={rows} columns={columns} rowId={row => row.id} parentId={treeParent}
          nameColumn="name" selected={selection} onSelect={row => select(row.id)} />
        : <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} selected={selection}
          onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {allowed && target && renderEditor(target, canEdit, () => setTarget(undefined), refresh)}
  </>;
}
