import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { useEditForm, useFormStateService, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { LoadingRegion, StatusPanel } from '@/shared/ui/page';
import { Button, Field, FormGroup, Modal, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar, ToolbarBar } from '@/shared/ui/toolbar';
import { useTableExport } from '@/shared/ui/table-export-action';
import { toast } from '@/shared/ui/toasts';
import { loadRuntimeItems, runtimeCommand, type RuntimeItem } from './runtime-data-api';

type Kind = 'queues' | 'tables';
type Target = { mode: 'new' } | { mode: 'edit' | 'view'; row: RuntimeItem };

export function RuntimeItems({ kind, name, onClose, onChanged }: {
  kind: Kind; name: string; onClose: () => void; onChanged: () => void;
}) {
  const { http } = useSession();
  const { canPage, canAction } = useWorkspace();
  const { allowLeave } = useFormStateService();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const [target, setTarget] = useState<Target>();
  const [selected, select] = useState<string>();
  const deleting = useRef(false);
  const [busy, setBusy] = useState(false);
  const queue = kind === 'queues';
  const suffix = queue ? 'QueueItem' : 'TableRow';
  const page = 'Web' + suffix + 'List';
  const editor = 'Web' + suffix + 'Edit';
  const allowed = canPage(page) && canAction(queue ? 'WebQueueList' : 'WebTableList', queue ? 'WebListQueueItems' : 'WebListTableRows');
  const action = (verb: string) => canAction(page, 'Web' + verb + suffix);
  const canOpenEditor = canPage(editor);
  const canView = canOpenEditor && action('View');
  const canAdd = canOpenEditor && action('Add');
  const canEdit = canOpenEditor && action('Edit');
  const canDelete = action('Delete');
  const load = useCallback((signal: AbortSignal) => allowed
    ? loadRuntimeItems(http, kind, name, signal) : Promise.resolve([]), [http, kind, name, allowed]);
  const result = useResource(load);
  const rows = result.state === 'ready' ? result.data : [];
  const row = rows.find(item => item.key === selected);
  const core = (key: string) => t(key, undefined, 'Core');
  const columns = [
    { key: 'key', title: core('Key'), render: item => item.key },
    { key: 'value', title: core('Value'), render: item => item.itemValue ?? '–' },
  ] satisfies Column<RuntimeItem>[];
  const exportAction = useTableExport<RuntimeItem>(queue ? 'queue-items' : 'runtime-table-rows', columns);

  function changed() {
    result.refresh();
    onChanged();
  }

  async function remove(item: RuntimeItem) {
    if (deleting.current || !canDelete || !allowed) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: item.key }), accept: core('Delete'), reject: core('Cancel') }))
        return;
      await runtimeCommand(http, kind + '/rows/delete', { name, key: item.key });
      select(undefined);
      toast.success(t('Common.Deleted'));
      changed();
    } catch (failure) { toast.error(error(failure, true)); }
    finally { deleting.current = false; setBusy(false); }
  }

  const permittedTarget = target && (target.mode === 'new' ? canAdd : target.mode === 'edit' ? canEdit : canView);
  return <Modal workspace title={name} onClose={() => {
    if (!deleting.current) void allowLeave().then(leave => { if (leave) onClose(); });
  }}>
    {allowed ? <>
      <Toolbar operation={page} actions={[
        { key: 'WebAdd' + suffix, label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
          enabled: !busy, run: () => setTarget({ mode: 'new' }) },
        { key: 'WebEdit' + suffix, label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'edit', row }); } },
        { key: 'WebView' + suffix, label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canView,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'view', row }); } },
        { key: 'WebDelete' + suffix, label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
          enabled: Boolean(row) && !busy, run: () => row && remove(row) },
        exportAction(rows, !busy),
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
      ]} />
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <DataTable label={name} rows={rows} columns={columns} rowId={item => item.key} selected={selected}
            onSelect={item => select(item.key)} resizable />}
      </LoadingRegion>
      {permittedTarget && target && <RuntimeItemEditor target={target} kind={kind} name={name}
        canSave={target.mode !== 'view' && canAction(editor, 'WebSave' + suffix)}
        onClose={() => setTarget(undefined)} onSaved={() => { setTarget(undefined); changed(); }} />}
    </> : <StatusPanel kind="denied" />}
  </Modal>;
}

function RuntimeItemEditor({ target, kind, name, canSave, onClose, onSaved }: {
  target: Target; kind: Kind; name: string; canSave: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const form = useEditForm(target.mode === 'new' ? { key: '', itemValue: '' }
    : { key: target.row.key, itemValue: target.row.itemValue ?? '' });
  const core = (key: string) => t(key, undefined, 'Core');
  const close = () => { void form.requestClose(onClose); };

  async function save() {
    if (!canSave || !form.dirty) return;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (!value.key.trim()) errors.key = t('Common.Required');
      if (!value.itemValue.trim()) errors.itemValue = t('Common.Required');
      else if (kind === 'queues') {
        try {
          const parsed: unknown = JSON.parse(value.itemValue);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        } catch { errors.itemValue = t('Runtime.InvalidQueueValue'); }
      }
      return errors;
    }, async value => {
      await runtimeCommand(http, kind + '/rows/save', undefined, { ...value, name });
      return value;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      onSaved();
    });
  }

  return <Modal workspace title={core(target.mode === 'new' ? 'New' : target.mode === 'edit' ? 'Edit' : 'View')} onClose={close}>
    <form className="grid gap-2" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <ToolbarBar>
        {canSave && <Button type="submit" disabled={form.pending || !form.dirty}>{core('Save')}</Button>}
        <Button disabled={form.pending} onClick={close}>{core('Close')}</Button>
      </ToolbarBar>
      <FormGroup title={name}>
        <Field label={core('Key')} value={form.values.key} readOnly={!canSave || target.mode !== 'new' || form.pending}
          onChange={value => form.change('key', value)} error={form.errors.key} />
        <div className="min-w-0 sm:col-span-2"><TextAreaField rows={9} label={core('Value')} value={form.values.itemValue}
          readOnly={!canSave || form.pending} onChange={value => form.change('itemValue', value)}
          error={form.errors.itemValue} /></div>
      </FormGroup>
    </form>
  </Modal>;
}
