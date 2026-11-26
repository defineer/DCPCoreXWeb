import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { recordStatus, type RecordStatus } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, ListPage, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { Button, Field, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput } from '@/shared/zoned-dates';
import { deleteJsonObject, getJsonChoices, getJsonObjects, getJsonTypes, type JsonObjectQuery, type JsonObjectRow } from './json-object-api';
import { JsonObjectEditor, type JsonTarget } from './json-object-editor';

const page = 'WebJsonObjectList';
const editor = 'WebJsonObjectEdit';

export function JsonObjectList() {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, timeZone, error } = useGlobalization();
  const confirm = useDialogManager();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<JsonObjectQuery>(() => {
    const today = localDateInput(new Date().toISOString(), timeZone);
    return { start: today, end: today, typeId: 0, status: recordStatus.active };
  });
  const [criteria, setCriteria] = useState<JsonObjectQuery>();
  const [selected, select] = useState<string>();
  const [target, setTarget] = useState<JsonTarget>();
  const [busy, setBusy] = useState(false);
  const [invalidRange, setInvalidRange] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('JsonObject.Management');
  const canSave = canPage(editor) && canAction(editor, 'WebSaveJsonObject');
  const canAdd = canSave && canAction(page, 'WebAddJsonObject');
  const canEdit = canSave && canAction(page, 'WebEditJsonObject');
  const canView = canPage(editor) && canAction(page, 'WebViewJsonObject');
  const canDelete = canAction(page, 'WebDeleteJsonObject');
  const loadTypes = useCallback((signal: AbortSignal) => getJsonTypes(http, signal), [http]);
  const typeId = draft.typeId;
  const loadChoices = useCallback((signal: AbortSignal) => typeId
    ? getJsonChoices(http, typeId, signal) : Promise.resolve({ parents: [], schemas: [] }), [http, typeId]);
  const loadRows = useCallback((signal: AbortSignal) => criteria
    ? getJsonObjects(http, criteria, signal) : Promise.resolve([]), [criteria, http]);
  const types = useResource(loadTypes);
  const choices = useResource(loadChoices);
  const result = useResource(loadRows);
  const typeRows = types.state === 'ready' ? types.data : [];
  const parents = choices.state === 'ready' ? choices.data.parents : [];
  const rows = result.state === 'ready' ? result.data : [];
  const row = rows.find(item => item.id === selected);
  const columns: Column<JsonObjectRow>[] = [
    { key: 'id', title: core('Id'), render: item => item.id },
    { key: 'name', title: core('Name'), render: item => item.name || '–' },
    { key: 'type', title: core('Type'), render: item => item.type || '–' },
    { key: 'parent', title: core('Parent'), render: item => item.parent || '–' },
    { key: 'active', title: core('Active'), render: item => core(item.isActive ? 'Yes' : 'No') },
  ];

  async function remove(item: JsonObjectRow) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: item.name || item.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteJsonObject(http, item.id);
      select(undefined);
      result.refresh();
      toast.success(t('Common.Deleted'));
    } catch (failure) { toast.error(error(failure, true)); }
    finally { deleting.current = false; setBusy(false); }
  }

  const targetAllowed = target && (target.mode === 'new' ? canAdd : target.mode === 'edit' ? canEdit : canView);
  return <Page id="JsonObjectList" title={title}>
    <ListPage resultsTitle={core('Objects')}
      tools={<Toolbar operation="JsonObjectList" actions={[
        { key: 'WebAddJsonObject', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
          enabled: types.state === 'ready' && !busy, run: () => setTarget({ mode: 'new', selectedType: typeId }) },
        { key: 'WebEditJsonObject', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'edit', row }); } },
        { key: 'WebViewJsonObject', label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canView,
          enabled: Boolean(row) && !busy, run: () => { if (row) setTarget({ mode: 'view', row }); } },
        { key: 'WebDeleteJsonObject', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
          enabled: Boolean(row) && !busy, run: () => row && remove(row) },
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, enabled: Boolean(criteria),
          run: result.refresh },
        { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, 'json-objects', [columns.map(column => column.title),
                ...rows.map(item => [item.id, item.name || '', item.type || '', item.parent || '', core(item.isActive ? 'Yes' : 'No')])]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={<form className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
        event.preventDefault();
        if (!draft.start || !draft.end || draft.start > draft.end) { setInvalidRange(true); return; }
        setInvalidRange(false);
        select(undefined);
        setCriteria({ ...draft });
      }}>
        <Field label={core('StartDate')} type="date" value={draft.start} onChange={start => setDraft(current => ({ ...current, start }))} />
        <Field label={core('EndDate')} type="date" value={draft.end} onChange={end => setDraft(current => ({ ...current, end }))}
          error={invalidRange ? t('JsonObject.InvalidRange') : undefined} />
        <SelectField label={core('Type')} value={typeId} onChange={value =>
          setDraft(current => ({ ...current, typeId: Number(value), parentId: undefined }))}
          options={[{ value: 0, label: core('All') }, ...typeRows.map(item => ({ value: item.id, label: item.name || String(item.id) }))]} />
        <SelectField label={core('Parent')} disabled={!typeId || !parents.length} value={draft.parentId || ''}
          onChange={parentId => setDraft(current => ({ ...current, parentId: parentId || undefined }))}
          options={[{ value: '', label: core('All') }, ...parents.map(item => ({ value: item.id, label: item.name || item.id }))]} />
        <SelectField label={core('RecordStatus')} value={draft.status} onChange={value =>
          setDraft(current => ({ ...current, status: Number(value) as RecordStatus }))}
          options={[{ value: recordStatus.all, label: core('All') }, { value: recordStatus.active, label: core('Active') },
            { value: recordStatus.inactive, label: core('Inactive') }, { value: recordStatus.deleted, label: core('Deleted') }]} />
        <div className="self-end"><Button type="submit" variant="primary" disabled={result.state === 'loading'}>{core('Search')}</Button></div>
        {types.state === 'error' && <div className="col-span-full"><StatusPanel kind="error" error={types.error} retry={types.refresh} /></div>}
        {choices.state === 'error' && <div className="col-span-full"><StatusPanel kind="error" error={choices.error} retry={choices.refresh} /></div>}
      </form>}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <DataTable label={title} rows={rows} columns={columns} rowId={item => item.id} selected={selected}
            onSelect={item => select(item.id)} resizable />}
      </LoadingRegion>
    </ListPage>
    {targetAllowed && target && <JsonObjectEditor target={target} types={typeRows} canEdit={canEdit}
      onClose={() => setTarget(undefined)} onSaved={() => { if (criteria) result.refresh(); else setCriteria({ ...draft }); }} />}
  </Page>;
}
