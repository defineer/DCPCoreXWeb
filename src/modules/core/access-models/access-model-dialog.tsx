import { useCallback, useRef } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { ApiFailure } from '@/shared/http';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, FormGroup, Modal, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { accessModelChange, getAccessModel, saveAccessModels,
  type AccessModel, type AccessModelDetail, type AccessModelScope } from './access-model-api';

export interface AccessModelTarget { row: AccessModel; mode: 'view' | 'edit' }

interface DialogProps {
  scope: AccessModelScope; target: AccessModelTarget; editable: boolean; onClose: () => void; onSaved: () => void;
}

export function AccessModelDialog(props: DialogProps) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { scope, target, onClose } = props;
  const close = useRef(onClose);
  const load = useCallback((signal: AbortSignal) => getAccessModel(http, scope, target.row, signal), [http, scope, target]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = target.row.elementName || String(target.row.id);
  return <Modal title={target.mode === 'edit' ? t('Directory.Edit', { name }) : name} workspace onClose={() => close.current()}>
    {result.state === 'ready' ? <AccessModelForm {...props} detail={result.data} closeRef={close} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function AccessModelForm({ scope, target, editable, detail, closeRef, onClose, onSaved }: DialogProps & {
  detail: AccessModelDetail; closeRef: { current: () => void };
}) {
  const { http } = useSession();
  const { preferences } = useWorkspace();
  const { t, date, error } = useGlobalization();
  const { row } = target;
  const persisted = useRef({ isActive: detail.isActive, isDeleted: detail.isDeleted });
  const form = useEditForm(persisted.current);
  const core = (key: string) => t(key, undefined, 'Core');
  const disabled = !editable || form.pending;
  closeRef.current = () => { void form.requestClose(onClose); };

  async function submit() {
    if (disabled || !form.dirty) return;
    await form.submit(() => ({}), async snapshot => {
      await saveAccessModels(http, scope, [accessModelChange({ ...row, ...persisted.current }, snapshot)], true);
      persisted.current = snapshot;
    }, failure => toast.error(failure instanceof ApiFailure && failure.status === 409 ? t('AccessModel.Stale') : error(failure, true)),
    newerChanges => {
      toast.success(t('Common.Saved'));
      onSaved();
      if (!newerChanges && preferences?.saveAndCloseBehaviour) onClose();
    });
  }

  return <form className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {editable && <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending || !form.dirty}>
        <WorkspaceIcon name="save" />{core('Save')}
      </Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={closeRef.current}>
        <WorkspaceIcon name="close" />{core('Close')}
      </Button>
    </ToolbarBar>
    <PageGroup title={core('General')}>
      <DefinitionList compact items={[[core('Id'), detail.id], [core('ParentId'), row.parentConfigurationElementId || '–'],
        [core('Parent'), row.elementName || '–']]} />
    </PageGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={form.values.isActive} disabled={disabled} onChange={value => {
        form.change('isActive', value);
        if (value) form.change('isDeleted', false);
      }} />
      <CheckField label={core('Deleted')} value={form.values.isDeleted} disabled={disabled || !form.values.isDeleted}
        onChange={() => { form.change('isDeleted', false); form.change('isActive', true); }} />
    </FormGroup>
    <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
        [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>
  </form>;
}
