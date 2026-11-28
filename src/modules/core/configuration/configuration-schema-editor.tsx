import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput, localDateInstant } from '@/shared/zoned-dates';
import { getConfigurationSchema, saveConfigurationSchema,
  type ConfigurationSchema, type ConfigurationSchemaRow, type ConfigurationTypeRow } from './configuration-type-api';

export type ConfigurationSchemaTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: ConfigurationSchemaRow };

export function ConfigurationSchemaEditor({ type, target, canEdit, canSave, onClose, onSaved }: {
  type: ConfigurationTypeRow; target: ConfigurationSchemaTarget; canEdit: boolean; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<ConfigurationSchema>();
  const [now] = useState(() => new Date().toISOString());
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback((signal: AbortSignal): Promise<ConfigurationSchema> =>
    id && (!created || canEdit) ? getConfigurationSchema(http, type.id, id, signal) : Promise.resolve(created ?? {
      id: 0, configurationElementTypeId: type.id, versionDate: now, isActive: true, isDeleted: false,
    }), [http, type.id, id, created, canEdit, now]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Schema', undefined, 'Core');
  const title = target.mode === 'view' ? target.row.version || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <SchemaForm detail={result.data} type={type} editable={canSave && target.mode !== 'view' && (!id || canEdit)}
      closeRef={close} onClose={onClose} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function SchemaForm({ detail, type, editable, closeRef, onClose, onSaved }: {
  detail: ConfigurationSchema; type: ConfigurationTypeRow; editable: boolean; closeRef: { current: () => void };
  onClose: () => void; onSaved: (value: ConfigurationSchema) => void;
}) {
  const { http } = useSession();
  const { t, date, error, timeZone } = useGlobalization();
  const originalDate = detail.versionDateWithOffset || detail.versionDate;
  const form = useEditForm({ ...detail, localDate: localDateInput(originalDate, timeZone) });
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: ConfigurationSchema | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (!value.version?.trim()) errors.version = t('Common.Required');
      if (!localDateInstant(value.localDate, timeZone, detail.id ? originalDate : undefined))
        errors.localDate = t('Configuration.InvalidVersionDate');
      if (!value.contentSchema?.trim()) errors.contentSchema = t('Common.Required');
      else {
        try {
          const schema: unknown = JSON.parse(value.contentSchema);
          if (typeof schema !== 'boolean' && (!schema || typeof schema !== 'object' || Array.isArray(schema))) throw new Error();
        } catch { errors.contentSchema = t('Configuration.InvalidSchema'); }
      }
      return errors;
    }, async value => {
      const { localDate, ...detail } = value;
      const timestamp = localDateInstant(localDate, timeZone, detail.id ? originalDate : undefined);
      if (!timestamp) throw new Error(t('Configuration.InvalidVersionDate'));
      const candidate = { ...detail, version: detail.version?.trim(), versionDate: timestamp, versionDateWithOffset: timestamp };
      saved = { ...candidate, id: await saveConfigurationSchema(http, candidate, timestamp) };
      return { ...saved, localDate };
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
      <Field label={core('ConfigurationElementType')} value={type.typeName || String(type.id)} readOnly onChange={() => {}} />
      <Field label={core('Version')} value={v.version ?? ''} maxLength={10} readOnly={disabled}
        onChange={value => form.change('version', value)} error={form.errors.version} />
      <Field label={core('VersionDate')} value={v.localDate} type="date" readOnly={disabled}
        onChange={value => form.change('localDate', value)} error={form.errors.localDate} />
      <div className="min-w-0 sm:col-span-2"><TextAreaField label={core('Schema')} value={v.contentSchema ?? ''} maxLength={1000}
        rows={10} readOnly={disabled} onChange={value => form.change('contentSchema', value)} error={form.errors.contentSchema} /></div>
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
