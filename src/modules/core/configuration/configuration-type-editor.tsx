import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getConfigurationType, getConfigurationTypeChoices, saveConfigurationType,
  type ConfigurationParent, type ConfigurationType, type ConfigurationTypeRow } from './configuration-type-api';

export type ConfigurationTypeTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: ConfigurationTypeRow };
const emptyType: ConfigurationType = { id: 0, isActive: true, isDeleted: false };

export function ConfigurationTypeEditor({ target, canEdit, canSave, onClose, onSaved }: {
  target: ConfigurationTypeTarget; canEdit: boolean; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<ConfigurationType>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, parents] = await Promise.all([
      id && (!created || canEdit) ? getConfigurationType(http, id, signal) : Promise.resolve(created ?? emptyType),
      getConfigurationTypeChoices(http, signal),
    ]);
    return { detail, parents };
  }, [http, id, created, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('ConfigurationElementType', undefined, 'Core');
  const title = target.mode === 'view' ? target.row.typeName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <TypeForm {...result.data} editable={canSave && target.mode !== 'view' && (!id || canEdit)}
      closeRef={close} onClose={onClose} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function TypeForm({ detail, parents, editable, closeRef, onClose, onSaved }: {
  detail: ConfigurationType; parents: ConfigurationParent[]; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (value: ConfigurationType) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const parentsAvailable = parents.filter(parent => parent.id !== detail.id &&
    (parent.isActive || parent.id === detail.parentConfigurationElementTypeId));
  const options = [{ value: 0, label: '–' }, ...parentsAvailable.map(parent => ({
    value: parent.id, label: parent.typeName || String(parent.id),
  }))];
  if (detail.parentConfigurationElementTypeId && !options.some(item => item.value === detail.parentConfigurationElementTypeId))
    options.push({ value: detail.parentConfigurationElementTypeId, label: detail.parentTypeName || String(detail.parentConfigurationElementTypeId) });

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: ConfigurationType | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      for (const field of ['typeName', 'keyName'] as const) if (!value[field]?.trim()) errors[field] = t('Common.Required');
      return errors;
    }, async value => {
      const candidate = { ...value, typeName: value.typeName?.trim(), keyName: value.keyName?.trim() };
      saved = { ...candidate, id: await saveConfigurationType(http, candidate) };
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
      <Field label={core('Name')} value={v.typeName ?? ''} maxLength={100} readOnly={disabled}
        onChange={value => form.change('typeName', value)} error={form.errors.typeName} />
      <Field label={core('KeyName')} value={v.keyName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('keyName', value)} error={form.errors.keyName} />
      <SelectField label={core('Parent')} value={v.parentConfigurationElementTypeId ?? 0} options={options} disabled={disabled}
        onChange={value => form.change('parentConfigurationElementTypeId', Number(value) || null)} />
      <TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={disabled} onChange={value => form.change('description', value)} />
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
