import { useCallback, useRef, useState } from 'react';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import type { DirectoryDetail } from './directory-contract';

export type DirectoryEditorTarget = { mode: 'new'; initial: DirectoryDetail } | { mode: 'edit'; id: number };

export function DirectoryEditorDialog({ target, noun, allowNew, allowEdit, canSave, load, save, onSaved, onClose }: {
  target: DirectoryEditorTarget; noun: string; allowNew: boolean; allowEdit: boolean; canSave: boolean;
  load: (id: number, signal: AbortSignal) => Promise<DirectoryDetail>;
  save: (value: DirectoryDetail) => Promise<number>; onSaved: () => void; onClose: () => void;
}) {
  const { t } = useGlobalization();
  const permitted = target.mode === 'edit' ? allowEdit : allowNew;
  const query = useCallback((signal: AbortSignal) => {
    if (!permitted) return Promise.resolve(undefined);
    return target.mode === 'new' ? Promise.resolve(target.initial) : load(target.id, signal);
  }, [target, load, permitted]);
  const result = useResource(query);
  const close = useRef(onClose);
  if (result.state !== 'ready' || !permitted) close.current = onClose;
  const [created, setCreated] = useState(false);
  const title = t(target.mode === 'new' && !created ? 'Directory.New' : 'Directory.Edit', { name: noun });

  return <Modal title={title} workspace onClose={() => close.current()}>
    {!permitted ? <StatusPanel kind="denied" /> : result.state === 'ready' && result.data
      ? <DirectoryEditorForm initial={result.data} allowNew={allowNew} allowEdit={allowEdit} canSave={canSave} save={save}
        onSaved={() => { setCreated(true); onSaved(); }} onClose={onClose} closeRef={close} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function DirectoryEditorForm({ initial, allowNew, allowEdit, canSave, save, onSaved, onClose, closeRef }: {
  initial: DirectoryDetail; allowNew: boolean; allowEdit: boolean; canSave: boolean; save: (value: DirectoryDetail) => Promise<number>;
  onSaved: () => void; onClose: () => void; closeRef: { current: () => void };
}) {
  const { t, date, error } = useGlobalization();
  const { preferences } = useWorkspace();
  const form = useEditForm(initial);
  const value = form.values;
  const core = (key: string) => t(key, undefined, 'Core');
  const writable = canSave && (value.id > 0 ? allowEdit : allowNew);
  const disabled = !writable || form.pending;
  closeRef.current = () => { void form.requestClose(onClose); };

  async function submit() {
    if (disabled) return;
    await form.submit(snapshot => {
      const errors: FormErrors = {};
      if (!snapshot.name?.trim()) errors.name = t('Common.Required');
      if (!snapshot.keyName?.trim()) errors.keyName = t('Common.Required');
      return errors;
    }, async snapshot => ({ ...snapshot, id: await save(snapshot) }),
    failure => toast.error(error(failure, true)), newerChanges => {
      toast.success(t('Common.Saved'));
      onSaved();
      if (!newerChanges && preferences?.saveAndCloseBehaviour) onClose();
    });
  }

  return <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {writable && <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending}>
        <WorkspaceIcon name="save" />{core('Save')}
      </Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={() => void form.requestClose(onClose)}>
        <WorkspaceIcon name="close" />{core('Close')}
      </Button>
    </ToolbarBar>
    <FormGroup title={core('General')}>
      <Field label={core('Id')} value={value.id || '–'} onChange={() => {}} readOnly />
      {value.parent && <>
        <Field label={core('ParentId')} value={value.parent.id ?? '–'} onChange={() => {}} readOnly />
        <Field label={core('Parent')} value={value.parent.name || '–'} onChange={() => {}} readOnly />
      </>}
      <Field autoFocus={writable} label={core('Name')} value={value.name ?? ''} disabled={disabled}
        onChange={next => form.change('name', next)} error={form.errors.name ?? form.errors.roleName ?? form.errors.workgroupName} />
      <Field label={core('KeyName')} value={value.keyName ?? ''} disabled={disabled}
        onChange={next => form.change('keyName', next)} error={form.errors.keyName} />
      <Field label={core('Description')} value={value.description ?? ''} disabled={disabled}
        onChange={next => form.change('description', next)} error={form.errors.description} />
    </FormGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={value.isActive} disabled={disabled} onChange={isActive =>
        form.setValues({ ...value, isActive, isDeleted: isActive ? false : value.isDeleted })} />
      <CheckField label={core('Deleted')} value={value.isDeleted} disabled={disabled || !value.isDeleted} onChange={() =>
        form.setValues({ ...value, isActive: true, isDeleted: false })} />
    </FormGroup>
    {value.id > 0 && <PageGroup title={core('Details')}><DefinitionList compact items={[
      [core('InsertedBy'), value.insertedBy ?? '–'], [core('InsertedDate'), date(value.insertedDate)],
      [core('UpdatedBy'), value.updatedBy ?? '–'], [core('UpdatedDate'), date(value.updatedDate)],
    ]} /></PageGroup>}
  </form>;
}
