import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { recordStatus, type RecordStatus } from '@/shared/contracts';
import { useEditForm } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { ApiFailure } from '@/shared/http';
import { useResource } from '@/shared/resource';
import { ListPage, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { LoadingRegion, StatusPanel } from '@/shared/ui/page';
import { CheckField, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusQuery } from '@/shared/ui/record-status-query';
import { useTableExport } from '@/shared/ui/table-export-action';
import { Toolbar, type ToolbarAction } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { TreeTable } from '@/shared/ui/tree-table';
import { accessModelChange, accessRightValues, getAccessModels, saveAccessModels, type AccessModel,
  type AccessModelScope } from './access-model-api';
import { AccessModelDialog, type AccessModelTarget } from './access-model-dialog';
type GrantField = 'checked' | 'isActive' | 'isDeleted';

function updateBranches(rows: AccessModel[], id: number, field: GrantField, value: boolean) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const siblings = children.get(row.parentConfigurationElementId) ?? [];
    siblings.push(row.id);
    children.set(row.parentConfigurationElementId, siblings);
  }

  const affected = new Set<number>();
  const pending = [id];
  while (pending.length) {
    const child = pending.pop();
    if (child === undefined || affected.has(child)) continue;
    affected.add(child);
    for (const next of children.get(child) ?? []) pending.push(next);
  }
  if (field === 'checked' && value) {
    let parent = byId.get(id)?.parentConfigurationElementId;
    while (parent && !affected.has(parent)) {
      const row = byId.get(parent);
      if (!row || row.checked) break;
      affected.add(parent);
      parent = row.parentConfigurationElementId;
    }
  }

  return rows.map(row => {
    if (!affected.has(row.id) || row.hasMultipleGrants) return row;
    if (field === 'isDeleted') {
      return row.isDeleted ? { ...row, isActive: true, isDeleted: false, checked: true } : row;
    }
    if (field === 'isActive' && !row.accessModelId && !row.checked) return row;
    return { ...row, isActive: value, checked: value, isDeleted: value ? false : row.isDeleted };
  });
}

export function AccessModelTreeList({ scope }: { scope: AccessModelScope }) {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const canSave = canAction('WebAccessModelTreeList', 'WebSaveAccessModels');
  const canView = canPage('WebAccessModelEdit') && canAction('WebAccessModelTreeList', 'WebViewAccessModel');
  const canEdit = canPage('WebAccessModelEdit') && canAction('WebAccessModelTreeList', 'WebEditAccessModel');
  const canSaveIndividual = canAction('WebAccessModelEdit', 'WebSaveAccessModel');
  const [status, setStatus] = useState<RecordStatus>(recordStatus.active);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<AccessModelTarget>();
  const userId = 'userId' in scope ? scope.userId : undefined;
  const roleId = 'roleId' in scope ? scope.roleId : undefined;
  const workgroupId = 'workgroupId' in scope ? scope.workgroupId : undefined;
  const load = useCallback((signal: AbortSignal) => {
    if (userId) return getAccessModels(http, { userId }, status, signal);
    if (roleId) return getAccessModels(http, { roleId }, status, signal);
    if (workgroupId) return getAccessModels(http, { workgroupId }, status, signal);
    throw new Error('Missing access model scope');
  }, [http, status, userId, roleId, workgroupId]);
  const result = useResource(load);
  const { t } = useGlobalization();

  return <>
    {result.state === 'ready' ? <AccessModelResults scope={scope} initial={result.data} status={status} editable={editing && canSave}
      canView={canView} canEdit={canEdit} open={setTarget}
      canSave={canSave} onEdit={() => { setEditing(true); setStatus(recordStatus.all); }}
      onStatus={next => { setEditing(false); setStatus(next); }}
      onCancel={() => { setEditing(false); result.refresh(); }}
      onRefresh={result.refresh}
      onSaved={() => { setEditing(false); toast.success(t('Common.Saved')); result.refresh(); }} />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <LoadingRegion loading><StatusPanel kind="loading" /></LoadingRegion>}
    {target && (target.mode === 'edit' ? canEdit : canView) && <AccessModelDialog scope={scope} target={target}
      editable={target.mode === 'edit' && canSaveIndividual} onClose={() => setTarget(undefined)} onSaved={result.refresh} />}
  </>;
}

function AccessModelResults({ scope, initial, status, editable, canSave, canView, canEdit, open,
  onEdit, onStatus, onCancel, onRefresh, onSaved }: {
  scope: AccessModelScope; initial: AccessModel[]; status: RecordStatus; editable: boolean; canSave: boolean;
  canView: boolean; canEdit: boolean; open: (target: AccessModelTarget) => void;
  onEdit: () => void; onStatus: (status: RecordStatus) => void; onCancel: () => void;
  onRefresh: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const form = useEditForm({ rows: initial });
  const [selectedId, select] = useState<number>();
  const [selectedGrantId, selectGrant] = useState(0);
  const [resolving, setResolving] = useState(false);
  const resolution = useRef(false);
  const selectedRow = initial.find(row => row.id === selectedId);
  const choices = selectedRow?.grantChoices ?? [];
  const selectedGrant = choices.find(grant => grant.id === selectedGrantId);
  const selected = selectedRow && (selectedGrant ? {
    ...selectedRow, accessModelId: selectedGrant.id, accessRight: selectedGrant.accessRight,
    isActive: selectedGrant.isActive, isDeleted: selectedGrant.isDeleted,
  } : selectedRow.accessModelId > 0 ? selectedRow : undefined);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('AccessModels');
  const change = (row: AccessModel, key: GrantField, value: boolean) => {
    if (editable && !form.pending) form.change('rows', updateBranches(form.values.rows, row.id, key, value));
  };
  const checkbox = (row: AccessModel, key: GrantField, label: string) => {
    if (!editable) return core(row[key] ? 'Yes' : 'No');
    const disabled = form.pending || row.hasMultipleGrants || (key === 'isActive' && !row.accessModelId && !row.checked) ||
      (key === 'isDeleted' && !row.isDeleted);
    return <CheckField label={t('AccessModel.FieldForElement', { field: label, name: row.elementName || row.id })}
      value={row[key]} onChange={value => change(row, key, value)} disabled={disabled} hideLabel />;
  };
  async function submit() {
    if (!editable || !form.dirty) return;
    await form.submit(() => ({}), async ({ rows }) => {
      const originals = new Map(initial.map(row => [row.id, row]));
      const changes = rows.flatMap(row => {
        const original = originals.get(row.id);
        if (!original || (original.isActive === row.isActive && original.isDeleted === row.isDeleted)) return [];
        return [accessModelChange(original, row)];
      });
      if (changes.length) await saveAccessModels(http, scope, changes);
    }, failure => {
      toast.error(failure instanceof ApiFailure && failure.status === 409 ? t('AccessModel.Stale') : error(failure, true));
    }, onSaved);
  }

  async function resolve(row: AccessModel) {
    const grants = row.equivalentGrantIds;
    if (!canSave || editable || resolution.current || !grants || grants.length < 2) return;
    resolution.current = true;
    setResolving(true);
    try {
      if (!await confirm({ message: t('AccessModel.ResolveConfirm', { name: row.elementName || row.id }),
        accept: t('AccessModel.ResolveDuplicates'), reject: core('Cancel') })) return;
      await saveAccessModels(http, scope, [accessModelChange({ ...row, accessModelId: grants[0] }, row)], false, grants);
      onSaved();
    } catch (failure) {
      toast.error(failure instanceof ApiFailure && failure.status === 409 ? t('AccessModel.Stale') : error(failure, true));
    } finally {
      resolution.current = false;
      setResolving(false);
    }
  }
  const statusText = (value: boolean) => core(value ? 'Yes' : 'No');
  const rightText = (value: AccessModel['accessRight']) => {
    const right = typeof value === 'number' ? accessRightValues[value] : value;
    return right === 'None' ? core('None') : t('AccessModel.Right.' + right);
  };
  const exportColumns = [
    { key: 'id', title: core('Id'), render: model => model.id, numeric: true },
    { key: 'name', title: core('Name'), render: model => {
      const name = model.elementName || String(model.id);
      if (!model.hasMultipleGrants) return name;
      return t(model.grantChoices?.length ? 'AccessModel.MultipleGrantChoices' : 'AccessModel.MultipleGrants', { name });
    } },
    { key: 'type', title: core('Type'), render: model => model.configurationElementTypeName ?? '–' },
    { key: 'checked', title: core('Checked'), render: model => statusText(model.checked) },
    { key: 'active', title: core('Active'), render: model => statusText(model.isActive) },
    { key: 'deleted', title: core('Deleted'), render: model => statusText(model.isDeleted) },
    { key: 'right', title: core('AccessRight'), render: model => rightText(model.accessRight) },
  ] satisfies Column<AccessModel>[];
  const exportAction = useTableExport<AccessModel>('access-models', exportColumns);
  const fields = { checked: 'checked', active: 'isActive', deleted: 'isDeleted' } as const;
  const columns: Column<AccessModel>[] = exportColumns.map(column => {
    const field = fields[column.key as keyof typeof fields];
    return editable && field ? { ...column, render: model => checkbox(model, field, column.title) } : column;
  });
  const actions: ToolbarAction[] = [
    { key: 'edit', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canSave && !editable, run: onEdit },
    { key: 'WebViewAccessModel', label: core('View'), icon: <WorkspaceIcon name="view" />,
      allowed: canView && !editable, enabled: Boolean(selected), run: () => { if (selected) open({ row: selected, mode: 'view' }); } },
    { key: 'WebEditAccessModel', label: t('AccessModel.EditSelected'), icon: <WorkspaceIcon name="edit" />,
      allowed: canEdit && !editable, enabled: Boolean(selected), run: () => { if (selected) open({ row: selected, mode: 'edit' }); } },
    { key: 'resolve-duplicates', label: t('AccessModel.ResolveDuplicates'), icon: <WorkspaceIcon name="edit" />,
      allowed: canSave && !editable && (selectedRow?.equivalentGrantIds?.length ?? 0) > 1, enabled: !resolving,
      run: () => { if (selectedRow) return resolve(selectedRow); } },
    { key: 'WebSaveAccessModels', label: core('Save'), icon: <WorkspaceIcon name="save" />,
      allowed: editable, enabled: form.dirty && !form.pending, run: submit },
    { key: 'cancel', label: core('Cancel'), allowed: editable, enabled: !form.pending,
      run: () => form.requestClose(onCancel) },
    { ...exportAction(initial), allowed: !editable },
    { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />,
      enabled: !form.pending, run: () => form.requestClose(onRefresh) },
  ];
  return <ListPage resultsTitle={title} tools={<Toolbar operation="AccessModelTreeList" actions={actions} />}
    query={<RecordStatusQuery value={status} disabled={form.pending}
      onChange={next => void form.requestClose(() => onStatus(next))}
      onSearch={() => void form.requestClose(onRefresh)}>
      {!editable && (canView || canEdit) && choices.length > 0 && <SelectField
        label={t('AccessModel.SelectGrant')} value={selectedGrantId} onChange={value => selectGrant(Number(value))}
        options={[{ value: 0, label: '–' }, ...choices.map(grant => ({ value: grant.id,
          label: t('AccessModel.GrantChoice', { id: grant.id, right: rightText(grant.accessRight),
            status: core(grant.isDeleted ? 'Deleted' : grant.isActive ? 'Active' : 'Inactive') }),
        }))]} />}
    </RecordStatusQuery>}>
    <TreeTable onPageChange={() => { select(undefined); selectGrant(0); }} label={title} columns={columns} rows={editable ? form.values.rows : initial}
      nameColumn="name" rowId={row => row.id} parentId={row => row.parentConfigurationElementId}
      selected={selectedId} onSelect={canView || canEdit || canSave ? row => {
        select(row.id);
        selectGrant(0);
      } : undefined} />
  </ListPage>;
}
