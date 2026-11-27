import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput, localDateInstant } from '@/shared/zoned-dates';
import { getConfigurationVersionDetail, saveConfigurationVersionMetadata,
  type ConfigurationVersionDetail } from './configuration-element-api';

interface EditorProps {
  tree: boolean;
  elementId: number;
  versionId: number;
  mode: 'new' | 'view' | 'edit';
  onClose: () => void;
  onSaved: (id: number) => void;
}

export function ConfigurationVersionEditor(props: EditorProps) {
  const { http } = useSession();
  const { canAction, preferences } = useWorkspace();
  const { t } = useGlobalization();
  const { tree, elementId, onClose, onSaved } = props;
  const [savedId, setSavedId] = useState(props.versionId);
  const canEditExisting = canAction('WebConfigurationElementVersionList', 'WebEditConfigurationElementVersion');
  const canViewExisting = canAction('WebConfigurationElementVersionList', 'WebViewConfigurationElementVersion');
  const mode = props.mode === 'new' && savedId ? (canEditExisting ? 'edit' : 'view') : props.mode;
  const close = useRef(onClose);
  const load = useCallback((signal: AbortSignal) =>
    getConfigurationVersionDetail(http, tree, elementId, savedId, signal), [http, tree, elementId, savedId]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;

  return <Modal workspace title={t('Configuration.VersionMetadata')} onClose={() => close.current()}>
    {result.state === 'ready' ? <VersionForm {...props} versionId={savedId} mode={mode}
      detail={result.data} closeRef={close} onSaved={id => {
      onSaved(id);
      if (preferences?.saveAndCloseBehaviour || (!savedId && !canEditExisting && !canViewExisting)) onClose();
      else if (!savedId) setSavedId(id);
      else result.refresh();
    }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function VersionForm({ tree, elementId, versionId, mode, onClose, onSaved, detail, closeRef }: EditorProps & {
  detail: ConfigurationVersionDetail;
  closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { t, date, error, timeZone } = useGlobalization();
  const { canAction } = useWorkspace();
  const editable = mode !== 'view' && detail.canSave
    && canAction('WebConfigurationElementVersionEdit', 'WebSaveConfigurationElementVersion');
  const form = useEditForm({
    version: detail.version ?? '',
    versionDate: localDateInput(detail.versionDate, timeZone),
    installedDate: localDateInput(detail.installedDate, timeZone),
    schemaId: detail.configurationElementTypeSchemaVersionId,
    objectTypeId: detail.objectTypeId,
    objectId: detail.objectId,
    isActive: detail.isActive,
    isDeleted: detail.isDeleted,
    replacementContent: '',
  });
  const canChooseScope = editable && (detail.canChangeScope || Boolean(form.values.replacementContent.trim()));
  const core = (key: string) => t(key, undefined, 'Core');
  const close = () => { void form.requestClose(onClose); };
  closeRef.current = close;

  async function submit() {
    if (!editable || !form.dirty) return;
    let id = versionId;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (!value.version.trim()) errors.version = t('Common.Required');
      if (!value.schemaId) errors.schemaId = t('Common.Required');
      if (canChooseScope && value.objectTypeId && value.objectId === '0')
        errors.objectId = t('Common.Required');
      if (!localDateInstant(value.versionDate, timeZone, detail.versionDate))
        errors.versionDate = t('Configuration.InvalidVersionDate');
      if (!localDateInstant(value.installedDate, timeZone, detail.installedDate))
        errors.installedDate = t('Configuration.InvalidVersionDate');
      if (value.replacementContent.trim()) {
        try { JSON.parse(value.replacementContent); }
        catch { errors.replacementContent = t('Configuration.InvalidReplacement'); }
      }
      return errors;
    }, async value => {
      const versionDate = localDateInstant(value.versionDate, timeZone, detail.versionDate);
      const installedDate = localDateInstant(value.installedDate, timeZone, detail.installedDate);
      if (!versionDate || !installedDate) throw new Error(t('Configuration.InvalidVersionDate'));
      const scopeChanged = canChooseScope && (value.objectTypeId !== detail.objectTypeId || value.objectId !== detail.objectId);
      id = await saveConfigurationVersionMetadata(http, tree, elementId, versionId, {
        version: value.version.trim(), versionDate, installedDate, expectedUpdatedDate: detail.updatedDate ?? null,
        schemaId: mode === 'new' || value.schemaId !== detail.configurationElementTypeSchemaVersionId ? value.schemaId : undefined,
        isActive: value.isActive, isDeleted: value.isDeleted,
        objectTypeId: scopeChanged ? value.objectTypeId : undefined,
        objectId: scopeChanged ? value.objectId : undefined,
        replacementContent: value.replacementContent.trim() || undefined,
      });
      return { ...value, replacementContent: '' };
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      onSaved(id);
    });
  }

  const readOnly = !editable || form.pending;
  const { schemaId, objectTypeId, objectId } = form.values;
  const schemas = detail.schemas ?? [];
  const scopes = detail.scopes ?? [];
  const scope = scopes.find(choice => choice.objectTypeId === objectTypeId);
  const objects = scope?.objects ?? [];
  const details: [string, ReactNode][] = [[core('Id'), detail.id], [core('CustomerId'), detail.customerId]];
  if (!editable) details.push([core('Schema'), detail.configurationElementTypeSchemaVersionId]);
  if (!canChooseScope)
    details.push([core('ObjectType'), detail.objectTypeId], [core('Object'), detail.objectId]);
  details.push([core('InsertedBy'), detail.insertedBy], [core('InsertedDate'), date(detail.insertedDate)],
    [core('UpdatedBy'), detail.updatedBy], [core('UpdatedDate'), date(detail.updatedDate)]);
  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button type="submit" disabled={form.pending || !form.dirty}>{core('Save')}</Button>}
      <Button disabled={form.pending} onClick={close}>{core('Close')}</Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      {(editable || mode === 'new') && <SelectField label={core('Schema')} value={schemaId} disabled={readOnly}
        options={[{ value: 0, label: '–' },
          ...(schemaId && !schemas.some(schema => schema.id === schemaId) ? [{ value: schemaId, label: String(schemaId) }] : []),
          ...schemas.map(schema => ({
          value: schema.id, label: schema.name || String(schema.id),
        }))]} onChange={value => form.change('schemaId', Number(value))} error={form.errors.schemaId} />}
      {canChooseScope && <>
        <SelectField label={core('ObjectType')} value={objectTypeId} disabled={readOnly}
          options={[{ value: 0, label: core('None') },
            ...(objectTypeId && !scope ? [{ value: objectTypeId, label: String(objectTypeId) }] : []),
            ...scopes.map(choice => ({ value: choice.objectTypeId, label: core(choice.key) }))]}
          onChange={value => form.setValues({ ...form.values, objectTypeId: Number(value), objectId: '0' })} />
        {objectTypeId !== 0 && <SelectField label={core('Object')} value={objectId} disabled={readOnly || !scope}
          options={[{ value: '0', label: '–' },
            ...(objectId !== '0' && !objects.some(object => String(object.id) === objectId) ? [{ value: objectId, label: objectId }] : []),
            ...objects.map(object => ({ value: String(object.id), label: object.name || String(object.id) }))]}
          onChange={value => form.change('objectId', value)} error={form.errors.objectId} />}
      </>}
      <Field label={core('Version')} value={form.values.version} maxLength={10} readOnly={readOnly}
        onChange={value => form.change('version', value)} error={form.errors.version} />
      <Field label={core('VersionDate')} value={form.values.versionDate} type="date" readOnly={readOnly}
        onChange={value => form.change('versionDate', value)} error={form.errors.versionDate} />
      <Field label={core('InstalledDate')} value={form.values.installedDate} type="date" readOnly={readOnly}
        onChange={value => form.change('installedDate', value)} error={form.errors.installedDate} />
      {editable && <div className="min-w-0 sm:col-span-2">
        <TextAreaField label={t('Configuration.ReplacementJson')} value={form.values.replacementContent} maxLength={1000}
          readOnly={readOnly} rows={8} onChange={value => {
            if (!detail.canChangeScope && !value.trim()) form.setValues({ ...form.values, replacementContent: value,
              objectId: detail.objectId, objectTypeId: detail.objectTypeId });
            else form.change('replacementContent', value);
          }}
          error={form.errors.replacementContent} />
      </div>}
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={form.values.isActive} disabled={readOnly} onChange={value =>
        form.setValues({ ...form.values, isActive: value, isDeleted: value ? false : form.values.isDeleted })} />
      <CheckField label={core('Deleted')} value={form.values.isDeleted} disabled={readOnly || !form.values.isDeleted}
        onChange={() => form.setValues({ ...form.values, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id > 0 && <PageGroup title={core('Details')}>
      <DefinitionList items={details} />
    </PageGroup>}
  </form>;
}
