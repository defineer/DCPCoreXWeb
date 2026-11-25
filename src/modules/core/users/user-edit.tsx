import { useCallback, useRef, useState } from 'react';
import { Files } from 'lucide-react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { ContactFields, loadPlaces, toEditorContact, toSaveContact, type Places } from '@/shared/contact-fields';
import { useResource } from '@/shared/resource';
import { useGlobalization } from '@/shared/globalization';
import { useEditForm, validateContact } from '@/shared/forms';
import { Button, CheckField, FormGroup, Modal, WorkspaceIcon } from '@/shared/ui/primitives';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { ObjectDocuments } from '@/shared/ui/documents';
import { toast } from '@/shared/ui/toasts';
import { emptyUser, getUser, saveUser, type UserEditView } from './user-api';

export type UserMode = 'new' | 'edit' | 'view';
export interface UserEditorTarget { mode: UserMode; userId?: number }

export function UserEdit({ target, onClose, onSaved }: {
  target: UserEditorTarget; onClose: () => void; onSaved: (id: number) => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const workspace = useWorkspace();
  const parentPermission = workspace.canAction('WebUserList',
    target.mode === 'new' ? 'WebAddUser' : target.mode === 'edit' ? 'WebEditUser' : 'WebViewUser');
  const allowed = workspace.canPage('WebUserEdit') && parentPermission;
  const [savedId, setSavedId] = useState<number>();
  const load = useCallback(async (signal: AbortSignal) => {
    if (!allowed) return null;
    const [user, places] = await Promise.all([
      target.mode === 'new' ? Promise.resolve(emptyUser()) : getUser(http, target.userId!, signal),
      loadPlaces(http, signal),
    ]);
    return { user, places };
  }, [allowed, http, target.mode, target.userId]);
  const result = useResource(load);
  const close = useRef(onClose);
  const title = t(target.mode === 'new' && !savedId ? 'User.New' : target.mode === 'view' ? 'User.View' : 'User.Edit');

  return <Modal title={title} workspace onClose={() => close.current()}>
    {!allowed ? <StatusPanel kind="denied" /> : result.state === 'ready' && result.data
      ? <UserEditForm original={result.data.user} places={result.data.places} mode={target.mode}
        onClose={onClose} onSaved={id => { setSavedId(id); onSaved(id); }} closeHook={close} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function UserEditForm({ original, places, mode, onClose, onSaved, closeHook }: {
  original: UserEditView; places: Places; mode: UserMode; onClose: () => void;
  onSaved: (id: number) => void; closeHook: { current: () => void };
}) {
  const { http } = useSession();
  const workspace = useWorkspace();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(toEditorContact(original));
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const originalContact = useRef(original);
  const value = form.values;
  const readOnly = mode === 'view' || !workspace.canAction('WebUserEdit', 'WebSaveUser') ||
    (value.id > 0 && !workspace.canAction('WebUserList', 'WebEditUser'));
  const canDocuments = value.id > 0 && workspace.canPage('WebObjectDocuments');
  const allows = {
    view: workspace.canAction('WebUserEdit', 'WebViewObjectDocument.UserEdit'),
    upload: !readOnly && workspace.canAction('WebUserEdit', 'WebAddObjectDocument.UserEdit'),
    delete: !readOnly && workspace.canAction('WebUserEdit', 'WebDeleteObjectDocument.UserEdit'),
  };
  closeHook.current = () => {
    if (documentsOpen) setDocumentsOpen(false);
    else void form.requestClose(onClose);
  };

  async function submit() {
    if (readOnly || !workspace.canAction('WebUserEdit', 'WebSaveUser')) return;
    await form.submit(snapshot => {
      const errors = validateContact(snapshot, t('Common.Required'), t('Common.Invalid'));
      const city = places.cities.find(candidate => candidate.id === snapshot.cityId);
      if (city && (city.countryId !== snapshot.countryId ||
        (snapshot.countryRegionId && city.countryRegionId !== snapshot.countryRegionId))) {
        errors.cityId = t('Common.Invalid');
      }
      return errors;
    }, async snapshot => {
      const request = toSaveContact(snapshot, originalContact.current);
      const id = await saveUser(http, request);
      originalContact.current = { ...request, id };
      return { ...snapshot, id };
    }, failure => toast.error(error(failure, true)), newerChanges => {
      toast.success(t('Common.Saved'));
      onSaved(originalContact.current.id);
      if (!newerChanges && workspace.preferences?.saveAndCloseBehaviour) onClose();
    });
  }
  return <form noValidate className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ToolbarBar>
      {!readOnly && <Button type="submit" variant="ghost" className="workspace-toolbar-button" disabled={form.pending}><WorkspaceIcon name="save" />{t('Save', undefined, 'Core')}</Button>}
      {canDocuments && (allows.view || allows.upload || allows.delete) && <Button variant="ghost" className="workspace-toolbar-button"
        disabled={form.pending} onClick={() => setDocumentsOpen(true)}><Files />{t('Common.Documents')}</Button>}
      <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={() => void form.requestClose(onClose)}>
        <WorkspaceIcon name="back" />{t('Close', undefined, 'Core')}
      </Button>
    </ToolbarBar>
    <div className="workspace-profile-groups workspace-fields">
      <ContactFields values={value} places={places} errors={form.errors} change={form.change}
        replace={form.setValues} isModified={form.isModified} disabled={readOnly} includeAdmin />
    </div>
    <FormGroup title={t('Common.Status')}>
      <CheckField label={t('Field.Blocked')} value={value.isBlocked} disabled={readOnly} onChange={next => form.change('isBlocked', next)} />
      <CheckField label={t('Field.SinglePassword')} value={value.isSingleUsablePassword} disabled={readOnly}
        onChange={next => form.change('isSingleUsablePassword', next)} />
      <CheckField label={t('Common.Active')} value={value.isActive} disabled={readOnly} onChange={next =>
        form.setValues({ ...value, isActive: next, isDeleted: next ? false : value.isDeleted })} />
      <CheckField label={t('Common.DeletedStatus')} value={value.isDeleted} disabled={readOnly || !value.isDeleted}
        onChange={next => form.setValues({ ...value, isDeleted: next, isActive: !next })} />
    </FormGroup>
    {value.id > 0 && <PageGroup title={t('Common.Details')}>
      <DefinitionList compact items={[
        [t('Field.LastPasswordChange'), date(value.lastPasswordChangedDate)],
        [t('Field.CreatedBy'), value.insertedBy || undefined], [t('Field.CreatedAt'), date(value.insertedDate)],
        [t('Field.UpdatedBy'), value.updatedBy || undefined], [t('Field.UpdatedAt'), date(value.updatedDate)],
      ]} />
    </PageGroup>}
    {documentsOpen && canDocuments && <ObjectDocuments http={http} userId={value.id}
      allow={allows} onClose={() => setDocumentsOpen(false)} />}
  </form>;
}
