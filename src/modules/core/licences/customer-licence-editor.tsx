import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { ApiFailure } from '@/shared/http';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput, localDateInstant } from '@/shared/zoned-dates';
import { getCustomerLicence, getCustomerLicenceChoices, saveCustomerLicence,
  type CustomerLicenceChoices, type CustomerLicenceRecord } from './licence-api';

const emptyChoices: CustomerLicenceChoices = { licences: [], licenceTypes: [] };

export function CustomerLicenceEditor({ customerId, id, canEdit, onClose, onSaved }: {
  customerId: number; id: number; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<CustomerLicenceRecord>();
  const currentId = id || created?.id || 0;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    if (currentId && !canEdit) return { choices: emptyChoices, detail: created };
    const [choices, detail] = await Promise.all([
      getCustomerLicenceChoices(http, customerId, currentId, signal),
      currentId ? getCustomerLicence(http, customerId, currentId, signal) : Promise.resolve(undefined),
    ]);
    return { choices, detail };
  }, [http, customerId, currentId, canEdit, created]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Licence.CustomerLicence');
  return <Modal title={t(currentId ? 'Directory.Edit' : 'Directory.New', { name })} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <CustomerLicenceForm {...result.data} customerId={customerId}
      editable={!currentId || canEdit} closeRef={close} onClose={onClose} onSaved={record => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!currentId) setCreated(record);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function CustomerLicenceForm({ customerId, detail, choices, editable, closeRef, onClose, onSaved }: {
  customerId: number; detail?: CustomerLicenceRecord; choices: CustomerLicenceChoices; editable: boolean;
  closeRef: { current: () => void }; onClose: () => void; onSaved: (record: CustomerLicenceRecord) => void;
}) {
  const { http } = useSession();
  const { t, timeZone, date, error } = useGlobalization();
  const originalStart = detail?.startDateWithOffset || detail?.startDate;
  const originalEnd = detail?.endDateWithOffset || detail?.endDate;
  const form = useEditForm({
    licenceId: detail?.licenceId ?? 0, licenceTypeId: detail?.licenceTypeId ?? 0,
    startDate: localDateInput(originalStart || new Date().toISOString(), timeZone),
    endDate: localDateInput(originalEnd, timeZone),
    maxUserCount: String(detail?.maxUserCount ?? ''), additionalPeriodAsDays: String(detail?.additionalPeriodAsDays ?? 0),
    isTrial: detail?.isTrial ?? false, description: detail?.description ?? '',
    isActive: detail?.isActive ?? true, isDeleted: detail?.isDeleted ?? false,
  });
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };

  async function submit() {
    if (disabled || !form.dirty) return;
    const start = localDateInstant(v.startDate, timeZone, originalStart);
    const end = localDateInstant(v.endDate, timeZone, originalEnd);
    const users = Number(v.maxUserCount);
    const period = Number(v.additionalPeriodAsDays);
    let saved: CustomerLicenceRecord | undefined;
    await form.submit(snapshot => {
      const errors: FormErrors = {};
      if (!snapshot.licenceId) errors.licenceId = t('Common.Required');
      if (!snapshot.licenceTypeId) errors.licenceTypeId = t('Common.Required');
      if (!start) errors.startDate = t(snapshot.startDate ? 'Common.Invalid' : 'Common.Required');
      if (!end) errors.endDate = t(snapshot.endDate ? 'Common.Invalid' : 'Common.Required');
      else if (start && Date.parse(start) > Date.parse(end)) errors.endDate = t('Licence.EndBeforeStart');
      if (!Number.isInteger(users) || users < 1 || users > 2147483647) errors.maxUserCount = t('Common.Invalid');
      if (!Number.isInteger(period) || period < -32768 || period > 32767) errors.additionalPeriodAsDays = t('Common.Invalid');
      return errors;
    }, async snapshot => {
      if (!start || !end) throw new ApiFailure('command');
      const record = { ...snapshot, customerId, id: detail?.id ?? 0, startDate: start, endDate: end,
        startDateWithOffset: start, endDateWithOffset: end, maxUserCount: users, additionalPeriodAsDays: period };
      const id = await saveCustomerLicence(http, customerId, record);
      saved = { ...record, id };
    }, failure => toast.error(failure instanceof ApiFailure && failure.code === 'CONFIGURATION001'
      ? t('Licence.OverlappingLicence') : error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
    });
  }

  const options = (list: CustomerLicenceChoices['licences'], current: number) => {
    const entries = [{ value: 0, label: '–' }, ...list.map(row => ({ value: row.id, label: row.name || String(row.id) }))];
    if (current && !entries.some(row => row.value === current)) entries.push({ value: current, label: String(current) });
    return entries;
  };

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
      <Field label={core('Id')} value={detail?.id || '–'} onChange={() => {}} readOnly />
      <SelectField label={core('Type')} value={v.licenceTypeId} options={options(choices.licenceTypes, v.licenceTypeId)}
        onChange={value => form.change('licenceTypeId', Number(value))} disabled={disabled} error={form.errors.licenceTypeId} />
      <SelectField label={core('Licence')} value={v.licenceId} options={options(choices.licences, v.licenceId)}
        onChange={value => form.change('licenceId', Number(value))} disabled={disabled} error={form.errors.licenceId} />
      <Field label={core('StartDate')} type="date" value={v.startDate} readOnly={disabled}
        onChange={value => form.change('startDate', value)} error={form.errors.startDate} />
      <Field label={core('EndDate')} type="date" value={v.endDate} readOnly={disabled}
        onChange={value => form.change('endDate', value)} error={form.errors.endDate} />
      <Field label={core('UserCount')} type="number" min={1} max={2147483647} value={v.maxUserCount} readOnly={disabled}
        onChange={value => form.change('maxUserCount', value)} error={form.errors.maxUserCount} />
      <Field label={core('AdditionalPeriodAsDays')} type="number" min={-32768} max={32767} value={v.additionalPeriodAsDays}
        readOnly={disabled} onChange={value => form.change('additionalPeriodAsDays', value)} error={form.errors.additionalPeriodAsDays} />
      <CheckField label={core('Trial')} value={v.isTrial} disabled={disabled} onChange={value => form.change('isTrial', value)} />
      <Field label={core('Description')} value={v.description} maxLength={1000} readOnly={disabled}
        onChange={value => form.change('description', value)} />
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isDeleted: false, isActive: true })} />
    </FormGroup>
    {detail && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
        [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
