import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus, SimpleDataView } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useEditForm, useFormStateService, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { deleteEventNotification, getEventNotification, getEventNotificationChoices, getEventNotifications, saveEventNotification,
  type EventNotification, type EventNotificationRow } from './event-notification-api';
import type { EventRow } from './event-api';

const page = 'WebEventNotificationList';
const editor = 'WebEventNotificationEdit';
type MappingTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: EventNotificationRow };

export function EventNotificationDialog({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const { allowLeave } = useFormStateService();
  const [selection, select] = useState<number>();
  const [target, setTarget] = useState<MappingTarget>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Notifications');
  const eventName = event.eventName?.trim() || String(event.id);
  const authorized = canPage(page) && canAction('WebEventList', 'WebListEventNotifications');
  const canSave = canPage(editor) && canAction(editor, 'WebSaveEventNotification');
  const canAdd = canSave && event.isActive && canAction(page, 'WebAddEventNotification');
  const canEdit = canSave && canAction(page, 'WebEditEventNotification');
  const canView = canPage(editor) && canAction(page, 'WebViewEventNotification');
  const canDelete = canAction(page, 'WebDeleteEventNotification');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getEventNotifications(http, event.id, status, signal), [http, event.id]);
  const refresh = () => setReload(version => version + 1);
  const columns: Column<EventNotificationRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.notificationName || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];

  async function remove(row: EventNotificationRow) {
    if (deleting.current || !authorized || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.notificationName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteEventNotification(http, event.id, row.id);
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
  return <Modal workspace title={eventName + ' - ' + title} onClose={() => {
    if (!deleting.current) void allowLeave().then(allowed => { if (allowed) onClose(); });
  }}>
    {authorized ? <RecordStatusResults title={title} operation="EventNotificationList" load={load} reloadVersion={reload}
      filters={<Field label={core('Event')} value={eventName} readOnly onChange={() => {}} />}
      actions={rows => {
        const row = rows.find(item => item.id === selection);
        const enabled = Boolean(row) && !busy;
        return [
          { key: 'WebAddEventNotification', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
            enabled: !busy, run: () => setTarget({ mode: 'new' }) },
          { key: 'WebEditEventNotification', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
            enabled, run: () => { if (row) setTarget({ mode: 'edit', row }); } },
          { key: 'WebDeleteEventNotification', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
            enabled, run: () => row && remove(row) },
          { key: 'WebViewEventNotification', label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView,
            enabled, run: () => { if (row) setTarget({ mode: 'view', row }); } },
          { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0 && !busy,
            actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
              try {
                await exportTable(format, 'event-notifications', [columns.map(column => column.title),
                  ...rows.map(item => [item.id, item.notificationName || '', core(item.isActive ? 'Yes' : 'No')])]);
              } catch (failure) { toast.error(error(failure)); }
            } })) },
        ];
      }}>
      {rows => <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} selected={selection}
        onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults> : <StatusPanel kind="denied" />}
    {authorized && allowed && target && <MappingEditor eventId={event.id} eventName={eventName} target={target}
      canEdit={canEdit} onClose={() => setTarget(undefined)} onSaved={refresh} />}
  </Modal>;
}

function MappingEditor({ eventId, eventName, target, canEdit, onClose, onSaved }: {
  eventId: number; eventName: string; target: MappingTarget; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<EventNotification>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, choices] = await Promise.all([
      id && (!created || canEdit) ? getEventNotification(http, eventId, id, signal)
        : Promise.resolve(created ?? { id: 0, eventId, notificationId: 0, isActive: true, isDeleted: false }),
      getEventNotificationChoices(http, eventId, signal),
    ]);
    return { detail, choices };
  }, [http, eventId, id, created, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Notification.Definition');
  const title = target.mode === 'view' ? target.row.notificationName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <MappingForm {...result.data} eventName={eventName}
      currentName={target.mode === 'new' ? undefined : target.row.notificationName}
      editable={target.mode !== 'view' && (!id || canEdit)} onClose={onClose} closeRef={close} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function MappingForm({ detail, choices, eventName, currentName, editable, closeRef, onClose, onSaved }: {
  detail: EventNotification; choices: SimpleDataView[]; eventName: string; currentName?: string | null; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (value: EventNotification) => void;
}) {
  const { http } = useSession();
  const { t, error, date } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  closeRef.current = () => { void form.requestClose(onClose); };
  const options = [{ value: 0, label: '–' }, ...choices.map(choice => ({ value: choice.id, label: choice.name || String(choice.id) }))];
  if (detail.notificationId && !options.some(option => option.value === detail.notificationId))
    options.push({ value: detail.notificationId, label: currentName || String(detail.notificationId) });

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: EventNotification | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (!value.notificationId) errors.notificationId = t('Common.Required');
      return errors;
    }, async value => {
      saved = { ...value, id: await saveEventNotification(http, value) };
      return saved;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
    });
  }

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button type="submit" variant="ghost" className="workspace-toolbar-button"
        disabled={form.pending || !form.dirty || v.isDeleted}><WorkspaceIcon name="save" />{core('Save')}</Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={closeRef.current}>
        <WorkspaceIcon name="close" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      <Field label={core('Event')} value={eventName} readOnly onChange={() => {}} />
      <SelectField label={t('Notification.Definition')} value={v.notificationId} options={options} disabled={disabled}
        onChange={value => form.change('notificationId', Number(value))} error={form.errors.notificationId} />
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id > 0 && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('Id'), detail.id], [core('InsertedBy'), detail.insertedBy ?? '–'],
        [core('InsertedDate'), date(detail.insertedDate)], [core('UpdatedBy'), detail.updatedBy ?? '–'],
        [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
