import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { useSession } from '@/app/session';
import { getPreferences, savePreferences, type WebUserPreferenceView } from '@/app/workspace-api';
import { useWorkspace } from '@/app/workspace';
import { useEditForm } from '@/shared/forms';
import { useResource } from '@/shared/resource';
import { useGlobalization } from '@/shared/globalization';
import { Page, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ClosePageButton, ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';

export function PreferencesPage() {
  const { http, state } = useSession();
  const { t } = useGlobalization();
  const userId = state.stage === 'authenticated' ? state.session.userId : 0;
  const load = useCallback((signal: AbortSignal) => getPreferences(http, userId, signal), [http, userId]);
  const result = useResource(load);
  return <Page id="MyPreferences" title={t('Page.Preferences')}>
    {result.state === 'ready' ? <PreferencesForm preferences={result.data} /> : result.state === 'loading'
      ? <StatusPanel kind="loading" /> : <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
  </Page>;
}

function PreferencesForm({ preferences }: { preferences: WebUserPreferenceView }) {
  const { http, applyPresentation } = useSession();
  const workspace = useWorkspace();
  const { t, error } = useGlobalization();
  const [preview, setPreview] = useState<string>();
  const [photoError, setPhotoError] = useState('');
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const file = useRef<File | undefined>(undefined);
  const form = useEditForm({ ...preferences, photoSelection: '' });
  const v = form.values;
  useEffect(() => {
    const controller = new AbortController();
    const chosen = v.photoSelection ? file.current : undefined;
    let url: string | undefined;
    const image = chosen ? Promise.resolve(chosen)
      : v.photo ? http.file('/api/document/getprofilephoto', {
        signal: controller.signal,
      }).then(result => result.blob) : Promise.resolve(undefined);
    void image.then(value => {
      if (!value || controller.signal.aborted || !['image/jpeg', 'image/png', 'image/gif'].includes(value.type)) return;
      url = URL.createObjectURL(value);
      setPreview(url);
    }).catch(() => undefined);
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      setPreview(undefined);
    };
  }, [http, v.photo, v.photoSelection]);
  const empty = { value: 0, label: t('Field.System') };
  const zones = [...new Set([v.timeZone ?? 'UTC', 'UTC', ...Intl.supportedValuesOf('timeZone')])];
  const applicationOptions = [empty, ...workspace.applications.map(app => ({ value: app.id, label: app.name ?? String(app.id) }))];
  const pageOptions = [empty, ...workspace.pageOptions(v.defaultApplicationId).map(page => ({ value: page.id, label: page.label }))];

  function pickPhoto(next: File) {
    if (form.pending) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(next.type) || next.size > 5 * 1024 * 1024) {
      setPhotoError(t('Common.FileInvalid'));
      return;
    }
    setPhotoError('');
    file.current = next;
    form.change('photoSelection', `${next.name}:${next.lastModified}:${next.size}`);
  }

  return <form noValidate className="grid gap-2" onSubmit={event => {
      event.preventDefault();
      if (photoError) return;
      const selected = file.current;
      void form.submit(values => {
        const errors: Record<string, string> = {};
        for (const [key, min, max] of [
          ['rowsPerPage', 10, 60], ['sessionTimeoutAsSeconds', 60, 36000], ['notifyBeforeSessionClosedAsSec', 60, 3600],
        ] as const) {
          if (!Number.isInteger(values[key]) || values[key] < min || values[key] > max) errors[key] = t('Common.Invalid');
        }
        return errors;
      }, async ({ photoSelection, ...values }) => {
        const upload = photoSelection ? selected : undefined;
        const photo = upload && !values.photo ? values.userId + '_photo.' + upload.name.split('.').at(-1) : values.photo;
        const saved = { ...values, photo };
        await savePreferences(http, saved, upload);
        workspace.setPreferences(saved);
        applyPresentation(saved);
        toast.success(t('Common.Saved'));
        return { ...saved, photoSelection: '' };
      }, failure => toast.error(error(failure, true)));
    }}>
    <ToolbarBar>
      <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending}><WorkspaceIcon name="save" />{t('Save', undefined, 'Core')}</Button>
      <ClosePageButton disabled={form.pending} />
    </ToolbarBar>
    <div className="workspace-account-groups workspace-fields">
      <FormGroup title={t('Common.General')}>
        <div className="grid gap-2 text-sm">
          <label className="workspace-photo-drop" data-drag-over={photoDragOver || undefined}
            onDragOver={event => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = form.pending ? 'none' : 'copy';
              setPhotoDragOver(!form.pending);
            }} onDragLeave={() => setPhotoDragOver(false)} onDrop={event => {
              event.preventDefault();
              setPhotoDragOver(false);
              if (event.dataTransfer.files[0]) pickPhoto(event.dataTransfer.files[0]);
            }}>
            {preview ? <img src={preview} alt="" /> : <span><ImageUp aria-hidden />{t('Field.PhotoDrop')}</span>}
            <input type="file" accept=".png,.jpg,.jpeg,.gif" aria-label={t('Field.Photo')}
              aria-describedby={photoError ? 'preferences-photo-error' : undefined} aria-invalid={Boolean(photoError)}
              disabled={form.pending} onChange={event => {
                if (event.target.files?.[0]) pickPhoto(event.target.files[0]);
                event.target.value = '';
              }} />
          </label>
          {photoError && <span id="preferences-photo-error" role="alert" className="text-destructive">{photoError}</span>}
        </div>
        <Field label={t('Field.DisplayName')} value={v.displayName ?? ''} onChange={value => form.change('displayName', value)} />
        <SelectField label={t('Field.Language')} value={v.language ?? 'tr-TR'}
          options={[{ value: 'tr-TR', label: 'Türkçe' }, { value: 'en-US', label: 'English' }]}
          onChange={value => form.change('language', value)} />
        <SelectField label={t('Field.TimeZone')} value={v.timeZone ?? 'UTC'} options={zones.map(value => ({ value, label: value }))}
          onChange={value => form.change('timeZone', value)} />
      </FormGroup>
      <FormGroup title={t('Application', undefined, 'Core')}>
        <Field label={t('Field.Timeout')} type="number" min={60} max={36000} value={v.sessionTimeoutAsSeconds}
          onChange={value => form.change('sessionTimeoutAsSeconds', Number(value))} error={form.errors.sessionTimeoutAsSeconds} />
        <Field label={t('Field.Warning')} type="number" min={60} max={3600} value={v.notifyBeforeSessionClosedAsSec}
          onChange={value => form.change('notifyBeforeSessionClosedAsSec', Number(value))} error={form.errors.notifyBeforeSessionClosedAsSec} />
        <SelectField label={t('Field.Theme')} value={v.theme.toLowerCase()} options={[
          { value: 'default', label: t('Field.System') }, { value: 'light', label: t('Field.Light') }, { value: 'dark', label: t('Field.Dark') },
        ]} onChange={value => form.change('theme', value[0].toUpperCase() + value.slice(1))} />
        <SelectField label={t('Field.MenuPosition')} value={v.menuPosition ?? ''}
          options={[{ value: '', label: t('Field.System') }, { value: 1, label: t('Field.Left') }, { value: 0, label: t('Field.Top') }]}
          onChange={value => form.change('menuPosition', value === '0' ? 0 : value === '1' ? 1 : null)} />
        <SelectField label={t('Field.DefaultApp')} value={v.defaultApplicationId} options={applicationOptions}
          onChange={value => form.setValues({ ...v, defaultApplicationId: Number(value), defaultPageId: 0 })} />
        <SelectField label={t('Field.DefaultPage')} value={v.defaultPageId} options={pageOptions}
          onChange={value => form.change('defaultPageId', Number(value))} />
        <Field label={t('Field.Rows')} type="number" min={10} max={60} value={v.rowsPerPage} error={form.errors.rowsPerPage}
          onChange={value => form.change('rowsPerPage', Number(value))} />
        <SelectField label={t('Field.Pager')} value={v.gridPagerPosition} options={[
          { value: 'Top', label: t('Field.Top') }, { value: 'Bottom', label: t('Field.Bottom') }, { value: 'TopAndBottom', label: t('Field.Both') },
        ]} onChange={value => form.change('gridPagerPosition', value)} />
        <CheckField label={t('Field.Collapsed')} value={v.menuCollapsed} onChange={value => form.change('menuCollapsed', value)} />
        <CheckField label={t('Field.TwoFactor')} value={v.twoFactorAuthentication} onChange={value => form.change('twoFactorAuthentication', value)} />
        <CheckField label={t('Field.SaveAndClose')} value={v.saveAndCloseBehaviour} onChange={value => form.change('saveAndCloseBehaviour', value)} />
      </FormGroup>
    </div>
  </form>;
}
