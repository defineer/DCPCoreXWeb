import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getJsonChoices, getJsonObject, saveJsonObject, type JsonObjectChoices,
  type JsonObjectDetail, type JsonObjectRow, type JsonObjectType } from './json-object-api';

export type JsonTarget = { mode: 'new'; selectedType: number } | { mode: 'edit' | 'view'; row: JsonObjectRow };
const blankChoices: JsonObjectChoices = { schemas: [], parents: [] };

export function JsonObjectEditor({ target, types, canEdit, onClose, onSaved }: {
  target: JsonTarget; types: JsonObjectType[]; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<JsonObjectDetail>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const startType = target.mode === 'new' ? target.selectedType : 0;
  const close = useRef(onClose);
  const load = useCallback((signal: AbortSignal): Promise<JsonObjectDetail> => id && (!created || canEdit)
    ? getJsonObject(http, id, signal)
    : Promise.resolve(created ?? { id: '0', typeId: startType, schemaId: 0, isActive: true, isDeleted: false }),
  [http, id, created, canEdit, startType]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Object', undefined, 'Core');
  return <Modal workspace title={target.mode === 'view' ? target.row.name || name : t(id ? 'Directory.Edit' : 'Directory.New', { name })}
    onClose={() => close.current()}>
    {result.state === 'ready' ? <JsonForm detail={result.data} types={types}
      editable={target.mode !== 'view' && (!id || canEdit)} closeRef={close} onClose={onClose} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function JsonForm({ detail, types, editable, closeRef, onClose, onSaved }: {
  detail: JsonObjectDetail; types: JsonObjectType[]; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (value: JsonObjectDetail) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const selectedType = types.find(item => item.id === v.typeId);
  const typeId = v.typeId;
  const loadChoices = useCallback((signal: AbortSignal) => typeId
    ? getJsonChoices(http, typeId, signal) : Promise.resolve(blankChoices), [http, typeId]);
  const choices = useResource(loadChoices);
  const data = choices.state === 'ready' ? choices.data : blankChoices;
  const readOnly = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const typeOptions = [{ value: 0, label: '–' }, ...types.filter(item => item.isActive || item.id === detail.typeId)
    .map(item => ({ value: item.id, label: item.name || String(item.id) }))];
  const schemas = [{ value: 0, label: t('JsonObject.LatestSchema') }, ...data.schemas.map(item => ({
    value: item.id, label: item.name || String(item.id),
  }))];
  if (v.schemaId && !schemas.some(item => item.value === v.schemaId)) schemas.push({ value: v.schemaId, label: String(v.schemaId) });
  const parents = [{ value: '', label: '–' }, ...data.parents.map(item => ({ value: item.id, label: item.name || item.id }))];
  if (v.parentId && !parents.some(item => item.value === v.parentId)) parents.push({ value: v.parentId, label: v.parentId });

  async function submit() {
    if (readOnly || !form.dirty || choices.state !== 'ready') return;
    let saved: JsonObjectDetail | undefined;
    await form.submit(values => {
      const errors: FormErrors = {};
      if (!values.name?.trim()) errors.name = t('Common.Required');
      if (!values.typeId) errors.typeId = t('Common.Required');
      if (selectedType?.parentTypeId && !values.parentId) errors.parentId = t('Common.Required');
      if (!values.content?.trim()) errors.content = t('Common.Required');
      else {
        try { JSON.parse(values.content); }
        catch { errors.content = t('JsonObject.InvalidJson'); }
      }
      return errors;
    }, async value => {
      const candidate = { ...value, name: value.name?.trim() };
      saved = { ...candidate, id: await saveJsonObject(http, candidate) };
      return saved;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
    });
  }

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button type="submit" disabled={form.pending || !form.dirty || choices.state !== 'ready'}>{core('Save')}</Button>}
      <Button onClick={closeRef.current} disabled={form.pending}>{core('Close')}</Button>
    </ToolbarBar>
    {choices.state === 'error' && <StatusPanel kind="error" error={choices.error} retry={choices.refresh} />}
    <FormGroup title={core('General')}>
      <Field label={core('Name')} value={v.name ?? ''} readOnly={readOnly} maxLength={100}
        onChange={value => form.change('name', value)} error={form.errors.name} />
      <SelectField label={core('Type')} value={v.typeId} options={typeOptions} disabled={readOnly || detail.id !== '0'}
        error={form.errors.typeId} onChange={value =>
          form.setValues({ ...v, typeId: Number(value), schemaId: 0, parentId: undefined })} />
      <SelectField label={core('Schema')} value={v.schemaId} options={schemas} disabled={readOnly || !v.typeId}
        onChange={value => form.change('schemaId', Number(value))} />
      {(selectedType?.parentTypeId || v.parentId) && <SelectField label={core('Parent')} value={v.parentId || ''}
        options={parents} disabled={readOnly} onChange={value => form.change('parentId', value || undefined)}
        error={form.errors.parentId} />}
      <TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={readOnly} onChange={value => form.change('description', value)} />
      <div className="min-w-0 sm:col-span-2"><TextAreaField label={core('Content')} value={v.content ?? ''} rows={12}
        readOnly={readOnly} onChange={value => form.change('content', value)} error={form.errors.content} /></div>
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={readOnly} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={readOnly || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id !== '0' && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('Id'), detail.id], [core('InsertedBy'), detail.insertedBy],
        [core('InsertedDate'), date(detail.insertedDate)], [core('UpdatedBy'), detail.updatedBy],
        [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
