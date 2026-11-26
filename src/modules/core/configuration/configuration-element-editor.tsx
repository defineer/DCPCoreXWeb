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
import { getConfigurationElement, saveConfigurationElement, type ConfigurationElement,
  type ConfigurationElementChoices, type ConfigurationElementRow } from './configuration-element-api';

type ElementTarget = { mode: 'new'; parent?: ConfigurationElementRow } | { mode: 'edit' | 'view'; row: ConfigurationElementRow };
const emptyElement: ConfigurationElement = {
  id: 0, configurationElementTypeId: 0, licenceTypeId: 0, listOrder: 0, isActive: true, isDeleted: false, isSystemElement: false,
};

export function ConfigurationElementEditor({ target, tree, choices, canEdit, onClose, onSaved }: {
  target: ElementTarget; tree: boolean; choices: ConfigurationElementChoices; canEdit: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<ConfigurationElement>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const parentId = target.mode === 'new' ? target.parent?.id : target.row.parentConfigurationElementId;
  const parentName = target.mode === 'new' ? target.parent?.elementName : target.row.parentElementName;
  const close = useRef(onClose);
  const load = useCallback((signal: AbortSignal): Promise<ConfigurationElement> => id && (!created || canEdit)
    ? getConfigurationElement(http, tree, id, signal)
    : Promise.resolve(created ?? { ...emptyElement, parentConfigurationElementId: parentId }),
  [http, tree, id, created, canEdit, parentId]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('ConfigurationElement', undefined, 'Core');
  const title = target.mode === 'view' ? target.row.elementName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <ElementForm detail={result.data} choices={choices} tree={tree} parentName={parentName}
      editable={target.mode !== 'view' && (!id || canEdit)} closeRef={close} onClose={onClose} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function ElementForm({ detail, choices, tree, parentName, editable, closeRef, onClose, onSaved }: {
  detail: ConfigurationElement; choices: ConfigurationElementChoices; tree: boolean; parentName?: string | null;
  editable: boolean; closeRef: { current: () => void }; onClose: () => void; onSaved: (value: ConfigurationElement) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm({ ...detail, order: String(detail.listOrder) });
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };

  function options(rows: SimpleDataView[], value: number) {
    const choices = [{ value: 0, label: '–' }, ...rows.map(row => ({ value: row.id, label: row.name || String(row.id) }))];
    if (value && !choices.some(item => item.value === value)) choices.push({ value, label: String(value) });
    return choices;
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: ConfigurationElement | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      for (const field of ['elementName', 'keyName'] as const) if (!value[field]?.trim()) errors[field] = t('Common.Required');
      if (!value.configurationElementTypeId) errors.configurationElementTypeId = t('Common.Required');
      if (!value.licenceTypeId) errors.licenceTypeId = t('Common.Required');
      const order = Number(value.order);
      if (!value.order.trim() || !Number.isInteger(order) || order < -32768 || order > 32767)
        errors.order = t('Configuration.InvalidOrder');
      return errors;
    }, async value => {
      const { order, ...current } = value;
      const candidate = { ...current, elementName: current.elementName?.trim(), keyName: current.keyName?.trim(), listOrder: Number(order) };
      saved = { ...candidate, id: await saveConfigurationElement(http, tree, candidate) };
      return { ...saved, order };
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
        <WorkspaceIcon name="back" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      <Field label={core('Id')} value={v.id || '–'} readOnly onChange={() => {}} />
      <Field label={core('ParentId')} value={v.parentConfigurationElementId ?? '–'} readOnly onChange={() => {}} />
      <Field label={core('Parent')} value={parentName || '–'} readOnly onChange={() => {}} />
      <Field label={core('Name')} value={v.elementName ?? ''} maxLength={100} readOnly={disabled}
        onChange={value => form.change('elementName', value)} error={form.errors.elementName} />
      <Field label={core('KeyName')} value={v.keyName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('keyName', value)} error={form.errors.keyName} />
      <SelectField label={core('Type')} value={v.configurationElementTypeId} options={options(choices.types, v.configurationElementTypeId)}
        disabled={disabled} onChange={value => form.change('configurationElementTypeId', Number(value))}
        error={form.errors.configurationElementTypeId} />
      <SelectField label={core('LicenceType')} value={v.licenceTypeId} options={options(choices.licenceTypes, v.licenceTypeId)}
        disabled={disabled} onChange={value => form.change('licenceTypeId', Number(value))} error={form.errors.licenceTypeId} />
      <Field label={core('ListOrder')} value={v.order} type="number" min={-32768} max={32767} readOnly={disabled}
        onChange={value => form.change('order', value)} error={form.errors.order} />
      <TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000} readOnly={disabled}
        onChange={value => form.change('description', value)} />
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id > 0 && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
        [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
