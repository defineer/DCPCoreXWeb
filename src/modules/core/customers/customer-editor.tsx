import { useCallback, useRef } from 'react';
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

export interface CustomerTarget { row: CustomerRow; mode: 'view' | 'edit' }
interface EditorProps { target: CustomerTarget; onClose: () => void; onSaved: () => void }

export function CustomerEditor(props: EditorProps) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { target, onClose } = props;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, places, types] = await Promise.all([
      getCustomer(http, target.row.id, signal), loadPlaces(http, signal), getCustomerTypes(http, signal),
    ]);
    return { detail, places, types };
  }, [http, target.row.id]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = target.row.customerName || String(target.row.id);
  return <Modal title={target.mode === 'edit' ? t('Directory.Edit', { name }) : name} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <CustomerForm {...props} {...result.data} closeRef={close} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function CustomerForm({ target, detail, places, types, closeRef, onClose, onSaved }: EditorProps & {
  detail: CustomerDetail; places: Places; types: Array<{ id: number; name?: string | null }>;
  closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { preferences } = useWorkspace();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const core = (key: string) => t(key, undefined, 'Core');
  const editable = target.mode === 'edit';
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
    await form.submit(validate, snapshot => saveCustomer(http, snapshot), failure => toast.error(error(failure, true)),
      newerChanges => {
        toast.success(t('Common.Saved'));
        onSaved();
        if (!newerChanges && preferences?.saveAndCloseBehaviour) onClose();
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
        options={types.map(type => ({ value: type.id, label: type.name || String(type.id) }))}
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
    <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('Id'), v.id], [core('InsertedBy'), detail.insertedBy ?? '–'],
        [core('InsertedDate'), date(detail.insertedDate)], [core('UpdatedBy'), detail.updatedBy ?? '–'],
        [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>
  </form>;
}
