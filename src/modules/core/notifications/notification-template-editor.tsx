import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { SimpleDataView } from '@/shared/contracts';
import { formIsDirty, useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, CheckField, Field, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getTemplate, getTemplateChoices, saveTemplate, type TemplateDetail, type TemplateLanguage, type TemplateRow } from './notification-template-api';

export type TemplateTarget = { mode: 'new' } | { mode: 'edit' | 'view'; row: TemplateRow };
const emptyTemplate: TemplateDetail = {
  id: 0, templateTypeId: 0, isActive: true, isDeleted: false, templateLanguages: [], editable: true,
};

export function NotificationTemplateEditor({ target, canEdit, onClose, onSaved }: {
  target: TemplateTarget; canEdit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t } = useGlobalization();
  const { preferences } = useWorkspace();
  const [created, setCreated] = useState<TemplateDetail>();
  const id = target.mode === 'new' ? created?.id : target.row.id;
  const close = useRef(onClose);
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, choices] = await Promise.all([
      id && (!created || canEdit) ? getTemplate(http, id, signal) : Promise.resolve(created ?? emptyTemplate),
      getTemplateChoices(http, signal),
    ]);
    return { detail, ...choices };
  }, [http, id, created, canEdit]);
  const result = useResource(load);
  if (result.state !== 'ready') close.current = onClose;
  const name = t('Notification.Template');
  const title = target.mode === 'view' ? target.row.templateName || name : t(id ? 'Directory.Edit' : 'Directory.New', { name });
  return <Modal workspace title={title} onClose={() => close.current()}>
    {result.state === 'ready' ? <TemplateForm {...result.data}
      editable={result.data.detail.editable && target.mode !== 'view' && (!id || canEdit)}
      onClose={onClose} closeRef={close} onSaved={value => {
        onSaved();
        if (preferences?.saveAndCloseBehaviour) onClose();
        else if (!id) setCreated(value);
        else result.refresh();
      }} /> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function TemplateForm({ detail, types, languages: availableLanguages, editable, closeRef, onClose, onSaved }: {
  detail: TemplateDetail; types: SimpleDataView[]; languages: string[]; editable: boolean; closeRef: { current: () => void };
  onClose: () => void; onSaved: (value: TemplateDetail) => void;
}) {
  const { http } = useSession();
  const { t, date, error } = useGlobalization();
  const form = useEditForm(detail);
  const v = form.values;
  const disabled = !editable || form.pending;
  const core = (key: string) => t(key, undefined, 'Core');
  closeRef.current = () => { void form.requestClose(onClose); };
  const typeOptions = [{ value: 0, label: '–' }, ...types.map(type => ({ value: type.id, label: type.name || String(type.id) }))];
  if (v.templateTypeId && !typeOptions.some(type => type.value === v.templateTypeId))
    typeOptions.push({ value: v.templateTypeId, label: String(v.templateTypeId) });

  function updateLanguage(index: number, value: TemplateLanguage) {
    form.change('templateLanguages', v.templateLanguages.map((item, position) => position === index ? value : item));
  }

  async function submit() {
    if (disabled || !form.dirty) return;
    let saved: TemplateDetail | undefined;
    await form.submit(value => {
      const errors: FormErrors = {};
      for (const field of ['templateName', 'keyName'] as const) if (!value[field]?.trim()) errors[field] = t('Common.Required');
      if (!value.templateTypeId) errors.templateTypeId = t('Common.Required');
      const languages = new Set<string>();
      value.templateLanguages.forEach((item, index) => {
        if (item.isDeleted) return;
        const language = item.language?.toLowerCase();
        if (!language) errors['language' + index] = t('Common.Required');
        else if (languages.has(language)) errors['language' + index] = t('Notification.DuplicateLanguage');
        else languages.add(language);
        if (!item.content?.trim() &&
          (!item.id || formIsDirty(detail.templateLanguages.find(original => original.id === item.id), item)))
          errors['content' + index] = t('Common.Required');
      });
      return errors;
    }, async value => {
      const changed = value.templateLanguages.filter(item =>
        !item.id || formIsDirty(detail.templateLanguages.find(original => original.id === item.id), item));
      const candidate = { ...value, templateName: value.templateName?.trim(), keyName: value.keyName?.trim() };
      saved = { ...candidate, id: await saveTemplate(http, candidate, changed) };
      return saved;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      if (saved) onSaved(saved);
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
    <FormGroup title={core('General')}>
      <Field label={core('Name')} value={v.templateName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('templateName', value)} error={form.errors.templateName} />
      <Field label={core('KeyName')} value={v.keyName ?? ''} maxLength={50} readOnly={disabled}
        onChange={value => form.change('keyName', value)} error={form.errors.keyName} />
      <SelectField label={core('Type')} value={v.templateTypeId} options={typeOptions} disabled={disabled}
        onChange={value => form.change('templateTypeId', Number(value))} error={form.errors.templateTypeId} />
      <TextAreaField label={core('Description')} value={v.description ?? ''} maxLength={1000}
        readOnly={disabled} onChange={value => form.change('description', value)} />
    </FormGroup>
    <PageGroup title={core('Language')}>
      <div className="grid gap-2">
        {v.templateLanguages.map((item, index) => {
          const cultureOptions = ['', ...availableLanguages];
          if (item.language && !cultureOptions.includes(item.language)) cultureOptions.push(item.language);
          return <fieldset key={item.id || 'new-' + index} className="grid min-w-0 gap-2 rounded border p-2">
            <legend className="px-1">{core('Language')} {index + 1}</legend>
            <SelectField label={core('Language')} disabled={disabled || item.isDeleted} value={item.language ?? ''}
              options={cultureOptions.map(value => ({ value, label: value || '–' }))}
              onChange={value => updateLanguage(index, { ...item, language: value })} error={form.errors['language' + index]} />
            <TextAreaField label={core('Content')} value={item.content ?? ''} maxLength={1000}
              readOnly={disabled || item.isDeleted} error={form.errors['content' + index]}
              onChange={value => updateLanguage(index, { ...item, content: value })} />
            <CheckField label={core('Active')} value={item.isActive} disabled={disabled || item.isDeleted}
              onChange={value => updateLanguage(index, { ...item, isActive: value })} />
            {item.id > 0 && <CheckField label={core('Deleted')} value={item.isDeleted} disabled={disabled}
              onChange={value => updateLanguage(index, { ...item, isDeleted: value, isActive: !value })} />}
            {editable && !item.id && <Button variant="ghost" disabled={form.pending}
              onClick={() => form.change('templateLanguages', v.templateLanguages.filter((_, position) => position !== index))}>
              {core('Delete')}
            </Button>}
          </fieldset>;
        })}
        {editable && <Button variant="ghost" disabled={form.pending} onClick={() =>
          form.change('templateLanguages', [...v.templateLanguages, { id: 0, isActive: true, isDeleted: false }])}>
          <WorkspaceIcon name="add" />{t('Notification.AddLanguage')}
        </Button>}
      </div>
    </PageGroup>
    <FormGroup title={core('Status')}>
      <CheckField label={core('Active')} value={v.isActive} disabled={disabled} onChange={value =>
        form.setValues({ ...v, isActive: value, isDeleted: value ? false : v.isDeleted })} />
      <CheckField label={core('Deleted')} value={v.isDeleted} disabled={disabled || !v.isDeleted}
        onChange={() => form.setValues({ ...v, isActive: true, isDeleted: false })} />
    </FormGroup>
    {detail.id > 0 && <PageGroup title={core('Details')}>
      <DefinitionList compact items={[[core('Id'), detail.id], [core('InsertedBy'), detail.insertedBy ?? '–'],
        [core('InsertedDate'), date(detail.insertedDate)], [core('UpdatedBy'), detail.updatedBy ?? '–'],
        [core('UpdatedDate'), date(detail.updatedDate)]]} />
    </PageGroup>}
  </form>;
}
