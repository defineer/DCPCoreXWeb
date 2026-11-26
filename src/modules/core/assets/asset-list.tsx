import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page } from '@/shared/ui/page';
import { SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { toast } from '@/shared/ui/toasts';
import { deleteAsset, getAssets, getAssetTypes, type AssetRow } from './asset-api';
import { AssetEditor, type AssetTarget } from './asset-editor';

export function AssetList() {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const navigate = useNavigate();
  const [assetType, setAssetType] = useState(-1);
  const [selection, select] = useState<string>();
  const [target, setTarget] = useState<AssetTarget>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Assets');
  const canView = canPage('WebAssetEdit') && canAction('WebAssetList', 'WebViewAsset');
  const canSave = canAction('WebAssetEdit', 'WebSaveAsset');
  const canAdd = canSave && canAction('WebAssetList', 'WebAddAsset');
  const canEdit = canSave && canAction('WebAssetList', 'WebEditAsset');
  const canDelete = canAction('WebAssetList', 'WebDeleteAsset');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getAssets(http, status, assetType, signal), [http, assetType]);
  const loadTypes = useCallback((signal: AbortSignal) => getAssetTypes(http, signal), [http]);
  const types = useResource(loadTypes);
  const refresh = () => setReload(version => version + 1);
  const columns: Column<AssetRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'identifier', title: core('Identifier'), render: row => row.identifier || '–' },
    { key: 'name', title: core('Name'), render: row => row.assetName || '–' },
    { key: 'type', title: core('Type'), render: row => row.assetTypeName || '–' },
  ];

  async function remove(row: AssetRow) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.assetName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteAsset(http, row.id);
      select(undefined);
      toast.success(t('Common.Deleted'));
      refresh();
    } catch (failure) {
      toast.error(error(failure, true));
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  }

  const allowed = target && (target.mode === 'new' ? canAdd : target.mode === 'edit' ? canEdit : canView);
  return <Page id="AssetList" title={title}>
    <RecordStatusResults title={title} operation="AssetList" load={load} reloadVersion={reload}
      filters={<SelectField label={core('Type')} value={assetType} disabled={types.state !== 'ready'}
        error={types.state === 'error' ? error(types.error) : undefined}
        options={[{ value: -1, label: t('Common.All') }, ...(types.state === 'ready' ? types.data : [])
          .map(type => ({ value: type.id, label: type.name || String(type.id) }))]}
        onChange={value => { select(undefined); setAssetType(Number(value)); }} />}
      actions={rows => {
        const row = rows.find(item => item.id === selection);
        const enabled = Boolean(row) && !busy;
        return [
          { key: 'WebAddAsset', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd, enabled: !busy,
            run: () => setTarget({ mode: 'new' }) },
          { key: 'WebEditAsset', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit, enabled,
            run: () => { if (row) setTarget({ mode: 'edit', row }); } },
          { key: 'WebDeleteAsset', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete, enabled,
            run: () => { if (row) return remove(row); } },
          { key: 'WebViewAsset', label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canView, enabled,
            run: () => { if (row) setTarget({ mode: 'view', row }); } },
          { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0 && !busy,
            actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
              try {
                await exportTable(format, 'assets', [columns.map(column => column.title),
                  ...rows.map(item => [item.id, item.identifier || '', item.assetName || '', item.assetTypeName || ''])]);
              } catch (failure) { toast.error(error(failure)); }
            } })) },
          { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
        ];
      }}>
      {rows => <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} selected={selection}
        onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {allowed && target && <AssetEditor target={target} canEdit={canEdit} onClose={() => setTarget(undefined)} onSaved={refresh} />}
  </Page>;
}
