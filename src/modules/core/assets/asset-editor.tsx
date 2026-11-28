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
import { getAsset, getAssetTypes, saveAsset, type AssetDetail, type AssetRow, type AssetType } from './asset-api';

export type AssetTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: AssetRow };
const emptyAsset: AssetDetail = { id: '0', assetTypeId: 0, isActive: true, isDeleted: false };

export function AssetEditor({ target, canEdit, canSave, onClose, onSaved }: {
  target: AssetTarget; canEdit: boolean; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<AssetDetail>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, types] = await Promise.all([
      id && (!created || canEdit) ? getAsset(http, id, signal) : Promise.resolve(created ?? emptyAsset),
      getAssetTypes(http, signal),
    ]);
    return { detail, types };
  }, [id, created, http, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Asset', undefined, 'Core');
  const title = target.mode === 'view' ? target.row.assetName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal title={title} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <AssetForm {...result.data} editable={canSave && (target.mode !== 'view' && (!id || canEdit))}
      onClose={onClose} closeRef={close} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function AssetForm({ detail, types, editable, closeRef, onClose, onSaved }: {
  detail: AssetDetail; types: AssetType[]; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (value: AssetDetail) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const typeOptions = [{ value: 0, label: '–' }, ...types.filter(type => type.isActive || type.id === detail.assetTypeId)
    .map(type => ({ value: type.id, label: type.name || String(type.id) }))];
  if (detail.assetTypeId && !typeOptions.some(type => type.value === detail.assetTypeId))
    typeOptions.push({ value: detail.assetTypeId, label: String(detail.assetTypeId) });

  function validate(value: AssetDetail) {
    const errors: FormErrors = {};
    for (const key of ['identifier', 'assetName'] as const) if (!value[key]?.trim()) errors[key] = t('Common.Required');
    if (!value.assetTypeId) errors.assetTypeId = t('Common.Required');
    if (value.features?.trim()) {
      try { JSON.parse(value.features); } catch { errors.features = t('Asset.InvalidJson'); }
    }
    return errors;
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: AssetDetail | undefined;
    await form.submit(validate, async value => {
      const id = await saveAsset(http, { ...value, identifier: value.identifier?.trim(), assetName: value.assetName?.trim() });
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
      <Field label={core('Identifier')} value={v.identifier ?? ''} maxLength={100} readOnly={disabled}
        onChange={value => form.change('identifier', value)} error={form.errors.identifier} />
      <Field label={core('Name')} value={v.assetName ?? ''} maxLength={100} readOnly={disabled}
        onChange={value => form.change('assetName', value)} error={form.errors.assetName} />
      <SelectField label={core('Type')} value={v.assetTypeId} options={typeOptions} disabled={disabled}
        onChange={value => form.change('assetTypeId', Number(value))} error={form.errors.assetTypeId} />
      <div className="min-w-0 sm:col-span-2"><TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={disabled} onChange={value => form.change('description', value)} /></div>
      <div className="min-w-0 sm:col-span-2"><TextAreaField label={core('Content')} value={v.features ?? ''}
        readOnly={disabled} onChange={value => form.change('features', value)} error={form.errors.features} /></div>
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id !== '0' && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
        [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
