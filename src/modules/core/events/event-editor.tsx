import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { SimpleDataView } from '@/shared/contracts';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { eventSeverities, processManagers, getEvent, getEventTypes, saveEvent, type EventRecord, type EventRow } from './event-api';

export type EventTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: EventRow };
const emptyEvent: EventRecord = {
  id: 0, eventTypeId: 0, severityId: '', processManagerKeyName: 'Default',
  isSystemEvent: true, isActive: true, isDeleted: false,
};

export function EventEditor({ target, canEdit, canSave, onClose, onSaved }: {
  target: EventTarget; canEdit: boolean; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<EventRecord>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, types] = await Promise.all([
      id && (!created || canEdit) ? getEvent(http, id, signal) : Promise.resolve(created ?? emptyEvent),
      getEventTypes(http, !id, signal),
    ]);
    return { detail, types };
  }, [id, created, http, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Event', undefined, 'Core');
  const title = target.mode === 'view' ? target.row.eventName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal title={title} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <EventForm {...result.data} editable={canSave && (target.mode !== 'view' && (!id || canEdit))}
      onClose={onClose} closeRef={close} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function EventForm({ detail, types, editable, closeRef, onClose, onSaved }: {
  detail: EventRecord; types: SimpleDataView[]; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (value: EventRecord) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const typeOptions = [{ value: 0, label: '–' }, ...types.map(type => ({ value: type.id, label: type.name || String(type.id) }))];
  if (v.eventTypeId && !typeOptions.some(type => type.value === v.eventTypeId)) {
    typeOptions.push({ value: v.eventTypeId, label: String(v.eventTypeId) });
  }
  const managers = [...new Set([v.processManagerKeyName || '', ...processManagers])].map(value => ({
    value, label: value ? t('Event.Process.' + value) : '–',
  }));

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: EventRecord | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      for (const key of ['eventName', 'keyName', 'processManagerKeyName'] as const) if (!value[key]?.trim()) errors[key] = t('Common.Required');
      if (!value.eventTypeId) errors.eventTypeId = t('Common.Required');
      if (!value.severityId) errors.severityId = t('Common.Required');
      return errors;
    }, async value => {
      const id = await saveEvent(http, { ...value, eventName: value.eventName?.trim(), keyName: value.keyName?.trim() });
      saved = { ...value, id };
      return saved;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
    });
  }

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
      <Field label={core('Name')} value={v.eventName ?? ''} maxLength={100} readOnly={disabled}
        onChange={value => form.change('eventName', value)} error={form.errors.eventName} />
      <Field label={core('KeyName')} value={v.keyName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('keyName', value)} error={form.errors.keyName} />
      <SelectField label={core('Type')} value={v.eventTypeId} options={typeOptions} disabled={disabled}
        onChange={value => form.change('eventTypeId', Number(value))} error={form.errors.eventTypeId} />
      <SelectField label={core('Severity')} value={v.severityId} disabled={disabled} error={form.errors.severityId}
        options={[{ value: '', label: '–' }, ...eventSeverities.map(value => ({ value, label: core(value) }))]}
        onChange={value => form.change('severityId', eventSeverities.find(item => item === value) ?? '')} />
      <SelectField label={core('ProcessManager')} value={v.processManagerKeyName || ''} options={managers} disabled={disabled}
        onChange={value => form.change('processManagerKeyName', value)} error={form.errors.processManagerKeyName} />
      <CheckField label={t('Event.System')} value={v.isSystemEvent} disabled={disabled} onChange={value => form.change('isSystemEvent', value)} />
      <div className="min-w-0 sm:col-span-2"><TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={disabled} onChange={value => form.change('description', value)} /></div>
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
