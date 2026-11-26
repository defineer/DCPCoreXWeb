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
import { getMembership, membershipChoices, membershipOperations, saveMembership, type MembershipDetail,
  type MembershipScope } from './membership-api';
import { localDateTimeInput, localDateTimeInstant } from '@/shared/zoned-dates';

export type MembershipTarget = { mode: 'new' } | { mode: 'edit' | 'view'; id: number; name?: string | null };
interface MemberEditorData {
  detail?: MembershipDetail;
  choices: Array<{ id: number; name?: string | null }>;
}

export function MembershipEditor({ scope, target, allowed, allowEdit, onClose, onSaved }: {
  scope: MembershipScope; target: MembershipTarget; allowed: boolean; allowEdit: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const close = useRef(onClose);
  const [created, setCreated] = useState(false);
  const read = useCallback(async (signal: AbortSignal): Promise<MemberEditorData> => {
    if (!allowed) return { choices: [] };
    const [detail, choices] = await Promise.all([
      target.mode === 'new' ? Promise.resolve(undefined) : getMembership(http, scope, target.id, signal),
      target.mode === 'view' ? Promise.resolve([]) : membershipChoices(http, scope, signal),
    ]);
    return { detail, choices };
  }, [http, scope, target, allowed]);
  const result = useResource(read);
  if (result.state !== 'ready' || !allowed) close.current = onClose;
  const noun = t(scope.kind === 'workgroupUser' ? 'Membership.WorkgroupAssignment' : 'Membership.RoleAssignment');
  const title = target.mode === 'view' ? noun : t(target.mode === 'new' && !created ? 'Directory.New' : 'Directory.Edit', { name: noun });
  return <Modal title={title} workspace onClose={() => close.current()}>
    {!allowed ? <StatusPanel kind="denied" /> : result.state === 'ready'
      ? <MembershipEditorForm scope={scope} target={target} data={result.data} allowEdit={allowEdit}
        onClose={onClose} closeRef={close} onSaved={() => { setCreated(true); onSaved(); }} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function MembershipEditorForm({ scope, target, data, allowEdit, onClose, onSaved, closeRef }: {
  scope: MembershipScope; target: MembershipTarget; data: MemberEditorData; allowEdit: boolean;
  onClose: () => void; onSaved: () => void; closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { preferences } = useWorkspace();
  const { t, date, error, timeZone } = useGlobalization();
  const operation = membershipOperations[scope.kind];
  const detail = data.detail;
  const counterpart = detail?.[operation.selectedKey] ?? 0;
  const original = useRef({
    start: detail?.startDateWithOffset || detail?.startDate || new Date().toISOString(),
    end: detail?.endDateWithOffset || detail?.endDate || null,
  });
  const form = useEditForm({
    id: detail?.id ?? 0, counterpartId: counterpart, start: localDateTimeInput(original.current.start, timeZone),
    end: localDateTimeInput(original.current.end, timeZone), isPrimary: detail?.isPrimary ?? false,
    isActive: detail?.isActive ?? true, isDeleted: detail?.isDeleted ?? false,
  });
  const value = form.values;
  const editable = target.mode !== 'view' && (value.id === 0 || allowEdit);
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  const label = core(scope.kind === 'userRole' ? 'Role' : 'User');
  const options = [{ value: 0, label: '–' }, ...data.choices.map(choice => ({ value: choice.id, label: choice.name || String(choice.id) }))];
  if (counterpart && !options.some(choice => choice.value === counterpart)) {
    options.push({ value: counterpart, label: target.mode !== 'new' && target.name || String(counterpart) });
  }
  closeRef.current = () => { void form.requestClose(onClose); };

  async function submit() {
    if (disabled || !form.dirty) return;
    const start = localDateTimeInstant(value.start, timeZone, original.current.start);
    const end = value.end ? localDateTimeInstant(value.end, timeZone, original.current.end) : null;
    await form.submit(snapshot => {
      const errors: FormErrors = {};
      if (!snapshot.counterpartId) errors.counterpartId = t('Common.Required');
      if (!start) errors.start = t(snapshot.start ? 'Membership.InvalidLocalTime' : 'Common.Required');
      if (end === undefined) errors.end = t('Membership.InvalidLocalTime');
      else if (start && end && Date.parse(end) <= Date.parse(start)) errors.end = t('Membership.EndAfterStart');
      return errors;
    }, async snapshot => {
      if (!start || end === undefined) throw new ApiFailure('command');
      const id = await saveMembership(http, scope, { ...snapshot, start, end });
      original.current = { start, end };
      return { ...snapshot, id };
    }, failure => toast.error(failure instanceof ApiFailure && failure.status === 409 ? t('Membership.Conflict') : error(failure, true)),
    newerChanges => {
      toast.success(t('Common.Saved'));
      onSaved();
      if (!newerChanges && preferences?.saveAndCloseBehaviour) onClose();
    });
  }

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending || !form.dirty}>
        <WorkspaceIcon name="save" />{core('Save')}
      </Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={() => void form.requestClose(onClose)}>
        <WorkspaceIcon name="back" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      <Field label={core('Id')} value={value.id || '–'} onChange={() => {}} readOnly />
      <SelectField label={label} options={options} value={value.counterpartId} disabled={disabled}
        onChange={next => form.change('counterpartId', Number(next))} error={form.errors.counterpartId} />
      <Field type="datetime-local" label={t('Membership.LocalDate', { name: core('StartDate'), zone: timeZone })}
        value={value.start} disabled={disabled} onChange={next => form.change('start', next)} error={form.errors.start} />
      <Field type="datetime-local" label={t('Membership.LocalDate', { name: core('EndDate'), zone: timeZone })}
        value={value.end} disabled={disabled} onChange={next => form.change('end', next)} error={form.errors.end} />
      {operation.hasPrimary && <CheckField label={core('Primary')} value={value.isPrimary} disabled={disabled}
        onChange={next => form.change('isPrimary', next)} />}
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={value.isActive} disabled={disabled} onChange={isActive =>
        form.setValues({ ...value, isActive, isDeleted: isActive ? false : value.isDeleted })} />
      <CheckField label={core('Deleted')} value={value.isDeleted} disabled={disabled || !value.isDeleted} onChange={() =>
        form.setValues({ ...value, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail && <PageGroup title={core('Details')}><DefinitionList compact items={[
      [core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
      [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)],
    ]} /></PageGroup>}
  </form>;
}
