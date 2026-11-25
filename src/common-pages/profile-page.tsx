import { useCallback } from 'react';
import { useSession } from '@/app/session';
import { ContactFields, contactSchema, loadPlaces, toEditorContact, toSaveContact, type ContactValues, type Places } from '@/shared/contact-fields';
import { genericResponse } from '@/shared/contracts';
import { confirmCommand, withQuery } from '@/shared/http';
import { useEditForm, validateContact } from '@/shared/forms';
import { useResource } from '@/shared/resource';
import { useGlobalization } from '@/shared/globalization';
import { Page, StatusPanel } from '@/shared/ui/page';
import { Button, WorkspaceIcon } from '@/shared/ui/primitives';
import { ClosePageButton, ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';

export function ProfilePage() {
  const { http, state } = useSession();
  const userId = state.stage === 'authenticated' ? state.session.userId : 0;
  const load = useCallback(async (signal: AbortSignal) => {
    const [profile, places] = await Promise.all([
      http.json(withQuery('/api/userservice/getuserprofile', { userId }), contactSchema, { signal }),
      loadPlaces(http, signal),
    ]);
    return { profile, places };
  }, [http, userId]);
  const result = useResource(load);
  const { t } = useGlobalization();
  return <Page id="MyProfile" title={t('UserProfile', undefined, 'Core')}>
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
    {result.state === 'ready' && <ProfileForm profile={result.data.profile} places={result.data.places} />}
  </Page>;
}

function ProfileForm({ profile, places }: { profile: ContactValues; places: Places }) {
  const { http } = useSession();
  const { t, error, date } = useGlobalization();
  const form = useEditForm(toEditorContact(profile));
  return <form noValidate className="grid gap-2" onSubmit={event => {
      event.preventDefault();
      void form.submit(values => validateContact(values, t('Common.Required'), t('Common.Invalid')), async values => {
        confirmCommand(await http.json('/api/userservice/saveuserprofile', genericResponse,
          { method: 'POST', body: toSaveContact(values, profile) }));
        toast.success(t('Common.Saved'));
      }, failure => toast.error(error(failure, true)));
    }}>
    <ToolbarBar>
      <Button type="submit" variant="ghost" className="workspace-toolbar-button" disabled={form.pending}>
        <WorkspaceIcon name="save" />{t('Save', undefined, 'Core')}
      </Button>
      <ClosePageButton disabled={form.pending} />
    </ToolbarBar>
    <div className="workspace-profile-groups workspace-account-groups workspace-fields">
      <ContactFields values={form.values} errors={form.errors} places={places} change={form.change} replace={form.setValues} isModified={form.isModified}
        generalDetails={<dl className="workspace-readonly"><dt>{t('Field.LastPasswordChange')}</dt>
          <dd>{date(profile.lastPasswordChangedDate)}</dd></dl>} />
    </div>
  </form>;
}
