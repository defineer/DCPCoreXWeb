import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { toast } from '@/shared/ui/toasts';
import { deleteTemplate, getTemplates, type TemplateRow } from './notification-template-api';
import { NotificationTemplateEditor, type TemplateTarget } from './notification-template-editor';

export function NotificationTemplateList() {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const navigate = useNavigate();
  const [selection, select] = useState<number>();
  const [target, setTarget] = useState<TemplateTarget>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Notification.Templates');
  const page = 'WebNotificationTemplateList';
  const editor = 'WebNotificationTemplateEdit';
  const canSave = canPage(editor) && canAction(editor, 'WebSaveNotificationTemplate');
  const canAdd = canSave && canAction(page, 'WebAddNotificationTemplate');
  const canEdit = canSave && canAction(page, 'WebEditNotificationTemplate');
  const canView = canPage(editor) && canAction(page, 'WebViewNotificationTemplate');
  const canDelete = canAction(page, 'WebDeleteNotificationTemplate');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getTemplates(http, status, signal), [http]);
  const refresh = () => setReload(version => version + 1);
  const columns: Column<TemplateRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.templateName || '–' },
    { key: 'key', title: core('KeyName'), render: row => row.keyName || '–' },
    { key: 'type', title: core('Type'), render: row => row.templateTypeName || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];

  async function remove(row: TemplateRow) {
    if (deleting.current || !canDelete || !row.editable) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.templateName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteTemplate(http, row.id);
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
  return <Page id="NotificationTemplateList" title={title}>
    <RecordStatusResults title={title} operation="NotificationTemplateList" load={load} reloadVersion={reload}
      actions={rows => {
        const row = rows.find(item => item.id === selection);
        return [
          { key: 'WebAddNotificationTemplate', label: core('New'), icon: <WorkspaceIcon name="add" />,
            allowed: canAdd, enabled: !busy, run: () => setTarget({ mode: 'new' }) },
          { key: 'WebEditNotificationTemplate', label: core('Edit'), icon: <WorkspaceIcon name="edit" />,
            allowed: canEdit, enabled: Boolean(row?.editable) && !busy,
            run: () => { if (row?.editable) setTarget({ mode: 'edit', row }); } },
          { key: 'WebDeleteNotificationTemplate', label: core('Delete'), icon: <WorkspaceIcon name="delete" />,
            allowed: canDelete, enabled: Boolean(row?.editable) && !busy, run: () => row && remove(row) },
          { key: 'WebViewNotificationTemplate', label: core('View'), icon: <WorkspaceIcon name="info" />,
            allowed: canView, enabled: Boolean(row) && !busy,
            run: () => { if (row) setTarget({ mode: 'view', row }); } },
          { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0 && !busy,
            actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({
              key: format, label: format.toUpperCase(), run: async () => {
                try {
                  await exportTable(format, 'notification-templates', [columns.map(column => column.title),
                    ...rows.map(item => [item.id, item.templateName || '', item.keyName || '',
                      item.templateTypeName || '', core(item.isActive ? 'Yes' : 'No')])]);
                } catch (failure) { toast.error(error(failure)); }
              },
            })) },
          { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
        ];
      }}>
      {rows => <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} selected={selection}
        onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {allowed && target && <NotificationTemplateEditor target={target} canEdit={canEdit}
      onClose={() => setTarget(undefined)} onSaved={refresh} />}
  </Page>;
}
