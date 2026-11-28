import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { SimpleDataView } from '@/shared/contracts';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable } from '@/shared/ui/data-table';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getLicence, getLicenceApplicationChoices, saveLicence, type LicenceApplication, type LicenceRecord } from './licence-api';

const newLicence: LicenceRecord = {
  id: 0, licenceName: '', additionalPeriodAsDays: 0, isActive: true, isDeleted: false, licenceApplications: [],
};
type Mapping = LicenceApplication & { rowKey: number };
interface LicenceValues {
  id: number; licenceName: string; period: string; description: string; isActive: boolean; isDeleted: boolean; mappings: Mapping[];
}

export function LicenceEditor({ id, canEdit, onClose, onSaved }: {
  id?: number; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<LicenceRecord>();
  const close = useRef(onClose);
  const persistedId = id ?? created?.id;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!persistedId || !canEdit) return { detail: created ?? newLicence, applications: [] };
    const [detail, applications] = await Promise.all([
      getLicence(http, persistedId, signal), getLicenceApplicationChoices(http, signal),
    ]);
    return { detail, applications };
  }, [http, persistedId, canEdit, created]);
  const resource = useResource(load);
  if (resource.state !== 'ready') close.current = onClose;
  const name = t('Licence', undefined, 'Core');
  return <Modal title={t(persistedId ? 'Directory.Edit' : 'Directory.New', { name })} workspace onClose={() => close.current()}>
    {resource.state === 'ready' ? <LicenceForm {...resource.data} editable={!persistedId || canEdit}
      closeRef={close} onClose={onClose} onSaved={record => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!persistedId) setCreated(record);
        else resource.refresh();
      }} />
      : resource.state === 'error' ? <StatusPanel kind="error" error={resource.error} retry={resource.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function LicenceForm({ detail, applications, editable, onClose, onSaved, closeRef }: {
  detail: LicenceRecord; applications: SimpleDataView[]; editable: boolean;
  onClose: () => void; onSaved: (value: LicenceRecord) => void; closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm<LicenceValues>({
    id: detail.id, licenceName: detail.licenceName ?? '', period: String(detail.additionalPeriodAsDays),
    description: detail.description ?? '', isActive: detail.isActive, isDeleted: detail.isDeleted,
    mappings: (detail.licenceApplications ?? []).map(row => ({ ...row, rowKey: row.id })),
  });
  const nextDraft = useRef(-1);
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const originals = new Map((detail.licenceApplications ?? []).map(row => [row.id, row]));
  const isChanged = (row: Mapping) => {
    const old = originals.get(row.id);
    return !old || old.applicationId !== row.applicationId || old.isActive !== row.isActive || old.isDeleted !== row.isDeleted;
  };
  const changeMapping = (mapping: Mapping, changes: Partial<LicenceApplication>) =>
    form.change('mappings', v.mappings.map(row => row.rowKey === mapping.rowKey ? { ...row, ...changes } : row));

  function validate(value: LicenceValues): FormErrors {
    const errors: FormErrors = {};
    if (!value.licenceName.trim()) errors.licenceName = t('Common.Required');
    const days = Number(value.period);
    if (!Number.isInteger(days) || days < 1 || days > 32767) errors.period = t('Common.Invalid');
    const occupied = new Set(value.mappings.filter(row => !row.isDeleted &&
      originals.get(row.id)?.applicationId === row.applicationId && !originals.get(row.id)?.isDeleted).map(row => row.applicationId));
    for (const row of value.mappings) {
      if (!row.applicationId && !row.isDeleted) errors[`application-${row.rowKey}`] = t('Common.Required');
      const old = originals.get(row.id);
      if (row.isDeleted || (old?.applicationId === row.applicationId && !old.isDeleted)) continue;
      if (occupied.has(row.applicationId)) errors[`application-${row.rowKey}`] = t('Licence.DuplicateApplication');
      occupied.add(row.applicationId);
    }
    return errors;
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let savedRecord: LicenceRecord | undefined;
    await form.submit(validate, async value => {
      const record = { ...detail, id: value.id, licenceName: value.licenceName.trim(), description: value.description,
        isActive: value.isActive, isDeleted: value.isDeleted, additionalPeriodAsDays: Number(value.period) };
      const id = await saveLicence(http, record, value.mappings.filter(isChanged));
      savedRecord = { ...record, id };
      return { ...value, id };
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (savedRecord) onSaved(savedRecord);
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
    <FormGroup title={core('Properties')}>
      <Field label={core('Id')} value={v.id || '–'} onChange={() => {}} readOnly />
      <Field label={core('Licence')} maxLength={50} value={v.licenceName} onChange={value => form.change('licenceName', value)}
        error={form.errors.licenceName} readOnly={disabled} />
      <Field type="number" min={1} max={32767} step={1} label={core('AdditionalPeriodAsDays')} value={v.period}
        onChange={value => form.change('period', value)}
        error={form.errors.period} readOnly={disabled} />
      <Field label={core('Description')} maxLength={1000} value={v.description}
        onChange={value => form.change('description', value)} readOnly={disabled} />
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isDeleted: false, isActive: true })} />
    </FormGroup>
    <PageGroup title={core('Applications')}>
      {editable && <ToolbarBar><Button variant="ghost" className="workspace-toolbar-button" disabled={disabled || !detail.id}
        onClick={() => form.change('mappings', [...v.mappings, { rowKey: nextDraft.current--, id: 0,
          applicationId: 0, isActive: true, isDeleted: false }])}>
        <WorkspaceIcon name="add" />{t('Licence.AddApplication')}
      </Button></ToolbarBar>}
      <DataTable label={core('Applications')} rows={v.mappings} rowId={row => row.rowKey} columns={[
        { key: 'id', title: core('Id'), render: row => row.id || '–', numeric: true },
        { key: 'application', title: core('Application'), render: row => {
          const options = [{ value: 0, label: '–' }, ...applications.map(app => ({ value: app.id, label: app.name || String(app.id) }))];
          if (row.applicationId && !options.some(option => option.value === row.applicationId))
            options.push({ value: row.applicationId, label: row.applicationName || String(row.applicationId) });
          return <SelectField label={core('Application')} hideLabel value={row.applicationId} options={options} disabled={disabled}
            error={form.errors[`application-${row.rowKey}`]} onChange={value => changeMapping(row, { applicationId: Number(value) })} />;
        } },
        { key: 'active', title: core('Active'), render: row => <CheckField label={core('Active')} hideLabel
          value={row.isActive} disabled={disabled} onChange={value => changeMapping(row, { isActive: value, isDeleted: value ? false : row.isDeleted })} /> },
        { key: 'deleted', title: core('Deleted'), render: row => <CheckField label={core('Deleted')} hideLabel
          value={row.isDeleted} disabled={disabled || !row.isDeleted}
          onChange={() => changeMapping(row, { isDeleted: false, isActive: true })} /> },
        { key: 'changed', title: core('Changed'), render: row => core(isChanged(row) ? 'Yes' : 'No') },
        { key: 'remove', title: core('Delete'), render: row => row.id === 0 && <Button variant="ghost" disabled={disabled}
          onClick={() => form.change('mappings', v.mappings.filter(value => value.rowKey !== row.rowKey))}>
          {core('Delete')}
        </Button> },
      ]} resizable />
    </PageGroup>
    <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
        [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>
  </form>;
}
