import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { loadPlaces, PlaceFields, type Places } from '@/shared/contact-fields';
import { useEditForm, validateContact, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getCustomer, getCustomerTypes, saveCustomer, type CustomerDetail, type CustomerRow } from './customer-api';

export type CustomerTarget = { mode: 'new' } | { row: CustomerRow; mode: 'view' | 'edit' };
interface EditorProps { target: CustomerTarget; canEdit: boolean; canView: boolean; onClose: () => void; onSaved: () => void }

export function CustomerEditor(props: EditorProps) {
  const { http } = useSession();
  const { t, culture, timeZone } = useGlobalization();
  const { target, onClose } = props;
  const [id, setId] = useState(target.mode === 'new' ? 0 : target.row.id);
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const draft: CustomerDetail = { id: 0, customerTypeId: 0, countryId: 0, countryRegionId: 0, cityId: 0,
      language: culture, timeZone, isActive: true, isDeleted: false };
    const [detail, places, types] = await Promise.all([
      id ? getCustomer(http, id, signal) : Promise.resolve(draft), loadPlaces(http, signal), getCustomerTypes(http, signal),
    ]);
    return { detail, places, types: id ? types : types.filter(type => type.isActive !== false) };
  }, [http, id, culture, timeZone]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = target.mode === 'new' ? t('Customer', undefined, 'Core') : target.row.customerName || String(target.row.id);
  const mode = target.mode === 'new' && id ? (props.canEdit ? 'edit' : 'view') : target.mode;
  const title = mode === 'view' ? name : t(mode === 'new' ? 'Directory.New' : 'Directory.Edit', { name });
  return <Modal title={title} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <CustomerForm {...result.data} mode={mode} onClose={onClose} closeRef={close}
      onSaved={(savedId, closeAfterSave) => {
        props.onSaved();
        if (closeAfterSave || (!id && !props.canEdit && !props.canView)) onClose();
        else if (!id) setId(savedId);
      }} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function CustomerForm({ mode, detail, places, types, closeRef, onClose, onSaved }: {
  mode: CustomerTarget['mode'];
  onClose: () => void;
  onSaved: (id: number, closeAfterSave: boolean) => void;
  detail: CustomerDetail; places: Places; types: Array<{ id: number; name?: string | null }>;
  closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { preferences } = useWorkspace();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const core = (key: string) => t(key, undefined, 'Core');
  const editable = mode !== 'view';
  const disabled = !editable || form.pending;
  const languages = [...new Set([v.language ?? '', 'en-US', 'tr-TR'])];
  const zones = [...new Set([v.timeZone ?? '', 'UTC', ...Intl.supportedValuesOf('timeZone')])];
  closeRef.current = () => { void form.requestClose(onClose); };

  function validate(values: CustomerDetail): FormErrors {
    const required = t('Common.Required');
    const errors: FormErrors = {};
    const contact = validateContact({ ...values, email: values.infoEmail, email2: values.supportEmail }, required, t('Common.Invalid'));
    for (const key of ['customerName', 'keyName', 'language', 'timeZone', 'supportEmail'] as const) {
      if (!values[key]?.trim()) errors[key] = required;
    }
    if (!values.customerTypeId) errors.customerTypeId = required;
    for (const key of ['phone', 'phone2', 'website', 'countryId', 'cityId'] as const) {
      if (contact[key]) errors[key] = contact[key];
    }
    if (contact.email) errors.infoEmail = contact.email;
    if (contact.email2) errors.supportEmail = contact.email2;
    return errors;
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let savedId = v.id;
    await form.submit(validate, async snapshot => {
      savedId = await saveCustomer(http, snapshot);
      return { ...snapshot, id: savedId };
    }, failure => toast.error(error(failure, true)),
      newerChanges => {
        toast.success(t('Common.Saved'));
        onSaved(savedId, !newerChanges && Boolean(preferences?.saveAndCloseBehaviour));
      });
  }

  const field = (key: 'customerName' | 'keyName' | 'description' | 'infoEmail' | 'supportEmail' | 'phone' | 'phone2' | 'website',
    label: string, type = 'text') => <Field label={label} value={v[key] ?? ''} type={type}
    onChange={value => form.change(key, value)} readOnly={disabled} error={form.errors[key]} />;

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending || !form.dirty}>
        <WorkspaceIcon name="save" />{core('Save')}
      </Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={closeRef.current}>
        <WorkspaceIcon name="back" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      {field('customerName', core('Name'))}{field('keyName', core('KeyName'))}
      <SelectField label={core('Type')} value={v.customerTypeId} disabled={disabled}
        options={[...(v.customerTypeId === 0 ? [{ value: 0, label: '–' }] : []),
          ...types.map(type => ({ value: type.id, label: type.name || String(type.id) }))]}
        onChange={value => form.change('customerTypeId', Number(value))} error={form.errors.customerTypeId} />
      {field('description', core('Description'))}
    </FormGroup>
    <FormGroup title={core('Contact')}>
      {field('infoEmail', core('InfoEmail'), 'email')}{field('supportEmail', core('SupportEmail'), 'email')}
      {field('phone', core('Phone'), 'tel')}{field('phone2', t('Field.Phone2'), 'tel')}
      {field('website', t('Field.Website'), 'url')}
      <PlaceFields values={v} places={places} errors={form.errors} disabled={disabled}
        replace={selection => form.setValues({ ...v, ...selection })} changeCity={city => form.change('cityId', city)} />
    </FormGroup>
    <FormGroup title={core('Parameters')}>
      <SelectField label={t('Field.Language')} value={v.language ?? ''} disabled={disabled}
        options={languages.map(value => ({ value, label: value || '–' }))}
        onChange={value => form.change('language', value)} error={form.errors.language} />
      <SelectField label={t('Field.TimeZone')} value={v.timeZone ?? ''} disabled={disabled}
        options={zones.map(value => ({ value, label: value || '–' }))}
        onChange={value => form.change('timeZone', value)} error={form.errors.timeZone} />
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value => {
        form.change('isActive', value);
        if (value) form.change('isDeleted', false);
      }} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => { form.change('isDeleted', false); form.change('isActive', true); }} />
    </FormGroup>
    {v.id > 0 && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('Id'), v.id], [core('InsertedBy'), detail.insertedBy ?? '–'],
        [core('InsertedDate'), date(detail.insertedDate)], [core('UpdatedBy'), detail.updatedBy ?? '–'],
        [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
