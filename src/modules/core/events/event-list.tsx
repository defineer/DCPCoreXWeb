import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
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
import { deleteEvent, getEvents, type EventRow } from './event-api';
import { EventEditor, type EventTarget } from './event-editor';
import { EventNotificationDialog } from './event-notification-dialog';

export function EventList() {
  const { http, state } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const navigate = useNavigate();
  const [selection, select] = useState<number>();
  const [target, setTarget] = useState<EventTarget>();
  const [notificationEvent, setNotificationEvent] = useState<EventRow>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Events');
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const canView = canPage('WebEventEdit') && canAction('WebEventList', 'WebViewEvent');
  const canSave = common && canAction('WebEventEdit', 'WebSaveEvent');
  const canAdd = canSave && canAction('WebEventList', 'WebAddEvent');
  const canEdit = canSave && canAction('WebEventList', 'WebEditEvent');
  const canDelete = common && canAction('WebEventList', 'WebDeleteEvent');
  const canListNotifications = canPage('WebEventNotificationList') && canAction('WebEventList', 'WebListEventNotifications');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getEvents(http, status, signal), [http]);
  const refresh = () => setReload(version => version + 1);
  const columns: Column<EventRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.eventName || '–' },
    { key: 'type', title: core('Type'), render: row => row.eventTypeName || '–' },
    { key: 'severity', title: core('Severity'), render: row => row.severityId ? core(row.severityId) : '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];

  async function remove(row: EventRow) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.eventName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteEvent(http, row.id);
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
  return <Page id="EventList" title={title}>
    <RecordStatusResults title={title} operation="EventList" load={load} reloadVersion={reload}
      actions={rows => {
        const row = rows.find(item => item.id === selection);
        const enabled = Boolean(row) && !busy;
        return [
          { key: 'WebAddEvent', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd, enabled: !busy,
            run: () => setTarget({ mode: 'new' }) },
          { key: 'WebEditEvent', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit, enabled,
            run: () => { if (row) setTarget({ mode: 'edit', row }); } },
          { key: 'WebDeleteEvent', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete, enabled,
            run: () => { if (row) return remove(row); } },
          { key: 'WebViewEvent', label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView, enabled,
            run: () => { if (row) setTarget({ mode: 'view', row }); } },
          { key: 'WebListEventNotifications', label: core('Notifications'), icon: <Bell size={16} />,
            allowed: canListNotifications, enabled: enabled && (common || row?.isSystemEvent === false),
            run: () => { if (row && (common || row.isSystemEvent === false)) setNotificationEvent(row); } },
          { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0 && !busy,
            actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
              try {
                await exportTable(format, 'events', [columns.map(column => column.title),
                  ...rows.map(item => [item.id, item.eventName || '', item.eventTypeName || '',
                    item.severityId ? core(item.severityId) : '', core(item.isActive ? 'Yes' : 'No')])]);
              } catch (failure) { toast.error(error(failure)); }
            } })) },
          { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
        ];
      }}>
      {rows => <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} selected={selection}
        onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {allowed && target && <EventEditor target={target} canEdit={canEdit} onClose={() => setTarget(undefined)} onSaved={refresh} />}
    {notificationEvent && <EventNotificationDialog event={notificationEvent} onClose={() => setNotificationEvent(undefined)} />}
  </Page>;
}
