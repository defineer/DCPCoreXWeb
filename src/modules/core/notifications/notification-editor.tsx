import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { formIsDirty, useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getNotification, getNotificationChoices, saveNotification, type NotificationRecord, type NotificationItem, type NotificationRow, type NotificationChoices } from './notification-api';

export type NotificationTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: NotificationRow };
const emptyNotification: NotificationRecord = {
  id: 0, isActive: true, isDeleted: false, notificationItems: [],
};

export function NotificationEditor({ target, canEdit, canSave, onClose, onSaved }: {
  target: NotificationTarget; canEdit: boolean; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<NotificationRecord>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, choices] = await Promise.all([
      id && (!created || canEdit) ? getNotification(http, id, signal) : Promise.resolve(created ?? emptyNotification),
      getNotificationChoices(http, signal),
    ]);
    return { detail, ...choices };
  }, [http, id, created, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Notification.Definition');
  const title = target.mode === 'view' ? target.row.notificationName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <NotificationForm {...result.data}
      editable={canSave && (target.mode !== 'view' && (!id || canEdit))}
      onClose={onClose} closeRef={close} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function NotificationForm({ detail, channels, templates, editable, closeRef, onClose, onSaved }: NotificationChoices & {
  detail: NotificationRecord; editable: boolean; closeRef: { current: () => void };
  onClose: () => void; onSaved: (value: NotificationRecord) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  closeRef.current = () => { void form.requestClose(onClose); };

  function updateItem(index: number, value: NotificationItem) {
    form.change('notificationItems', v.notificationItems.map((item, position) => position === index ? value : item));
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: NotificationRecord | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      for (const field of ['notificationName', 'keyName'] as const)
        if (!value[field]?.trim()) errors[field] = t('Common.Required');
      if (!value.id && !value.notificationItems.some(item => !item.isDeleted)) errors.items = t('Common.Required');
      value.notificationItems.forEach((item, index) => {
        if (item.isDeleted || !formIsDirty(detail.notificationItems.find(original => original.id === item.id), item)) return;
        if (!item.notificationTypeId) errors['channel' + index] = t('Common.Required');
        if (!item.notificationTemplateId) errors['template' + index] = t('Common.Required');
        if (!item.notificationTypeContent?.trim()) errors['content' + index] = t('Common.Required');
        else {
          try {
            const content: unknown = JSON.parse(item.notificationTypeContent);
            if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error();
          } catch { errors['content' + index] = t('Notification.InvalidChannelContent'); }
        }
      });
      return errors;
    }, async value => {
      const changes = value.notificationItems.filter(item =>
        !item.id || formIsDirty(detail.notificationItems.find(original => original.id === item.id), item));
      const candidate = { ...value, notificationName: value.notificationName?.trim(), keyName: value.keyName?.trim() };
      saved = { ...candidate, id: await saveNotification(http, candidate, changes) };
      return saved;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
    });
  }

  const options = (records: NotificationChoices['channels'], selected: number) => {
    const mapped = [{ value: 0, label: '–' }, ...records.map(record => ({ value: record.id, label: record.name || String(record.id) }))];
    if (selected && !mapped.some(option => option.value === selected)) mapped.push({ value: selected, label: String(selected) });
    return mapped;
  };

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button type="submit" variant="ghost" className="workspace-toolbar-button" disabled={form.pending || !form.dirty}>
        <WorkspaceIcon name="save" />{core('Save')}
      </Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={closeRef.current}>
        <WorkspaceIcon name="close" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      <Field label={core('Name')} value={v.notificationName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('notificationName', value)} error={form.errors.notificationName} />
      <Field label={core('KeyName')} value={v.keyName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('keyName', value)} error={form.errors.keyName} />
      <TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={disabled} onChange={value => form.change('description', value)} />
    </FormGroup>
    <PageGroup title={core('Items')}>
      <div className="grid gap-2">
        {form.errors.items && <p role="alert" className="text-destructive">{form.errors.items}</p>}
        {v.notificationItems.map((item, index) => <fieldset key={item.id || 'new-' + index} className="grid min-w-0 gap-2 rounded border p-2">
          <legend className="px-1">{core('Notification')} {index + 1}</legend>
          <SelectField label={core('NotificationType')} disabled={disabled || item.isDeleted} value={item.notificationTypeId}
            options={options(channels, item.notificationTypeId)} error={form.errors['channel' + index]}
            onChange={value => updateItem(index, { ...item, notificationTypeId: Number(value), notificationTemplateId: 0 })} />
          <SelectField label={t('Notification.Template')} disabled={disabled || item.isDeleted || !item.notificationTypeId}
            value={item.notificationTemplateId} error={form.errors['template' + index]}
            options={options(templates.filter(template => template.notificationTypeId === item.notificationTypeId), item.notificationTemplateId)}
            onChange={value => updateItem(index, { ...item, notificationTemplateId: Number(value) })} />
          <TextAreaField label={core('Content')} value={item.notificationTypeContent ?? ''} maxLength={1000}
            readOnly={disabled || item.isDeleted} error={form.errors['content' + index]}
            onChange={value => updateItem(index, { ...item, notificationTypeContent: value })} />
          <CheckField label={core('Active')} value={item.isActive} disabled={disabled || item.isDeleted}
            onChange={value => updateItem(index, { ...item, isActive: value })} />
          {item.id > 0 && <CheckField label={core('Deleted')} value={item.isDeleted} disabled={disabled}
            onChange={value => updateItem(index, { ...item, isDeleted: value, isActive: !value })} />}
          {editable && !item.id && <Button variant="ghost" disabled={form.pending}
            onClick={() => form.change('notificationItems', v.notificationItems.filter((_, position) => position !== index))}>
            {core('Delete')}
          </Button>}
        </fieldset>)}
        {editable && <Button variant="ghost" disabled={form.pending} onClick={() =>
          form.change('notificationItems', [...v.notificationItems, {
            id: 0, notificationTypeId: 0, notificationTemplateId: 0, isActive: true, isDeleted: false,
          }])}>
          <WorkspaceIcon name="add" />{t('Notification.AddItem')}
        </Button>}
      </div>
    </PageGroup>
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
