import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { useTableExport } from '@/shared/ui/table-export-action';
import { toast } from '@/shared/ui/toasts';
import { deleteLicence, getLicences, type LicenceRow } from './licence-api';
import { LicenceDetail } from './licence-detail';
import { LicenceEditor } from './licence-editor';

export function LicenceList() {
  const { http, state } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const [selected, select] = useState<number>();
  const [target, setTarget] = useState<LicenceRow>();
  const [editor, setEditor] = useState<number>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const canView = canPage('WebLicenceEdit') && canAction('WebLicenceList', 'WebViewLicence');
  const canSave = common && canAction('WebLicenceEdit', 'WebSaveLicence');
  const canAdd = canSave && canAction('WebLicenceList', 'WebAddLicence');
  const canEdit = canSave && canAction('WebLicenceList', 'WebEditLicence');
  const canDelete = common && canAction('WebLicenceList', 'WebDeleteLicence');
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Licences');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getLicences(http, status, signal), [http]);
  const refresh = () => setReload(value => value + 1);
  async function remove(row: LicenceRow) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.licenceName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteLicence(http, row.id);
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
  const columns = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Licence'), render: row => row.licenceName || '–' },
    { key: 'period', title: core('AdditionalPeriodAsDays'), render: row => row.additionalPeriodAsDays, numeric: true },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ] satisfies Column<LicenceRow>[];
  const exportAction = useTableExport<LicenceRow>('licences', columns);
  return <Page id="LicenceList" title={title}>
    <RecordStatusResults title={title} operation="LicenceList" load={load} reloadVersion={reload} actions={rows => {
      const row = rows.find(item => item.id === selected);
      const enabled = Boolean(row) && !busy;
      return [
        { key: 'WebAddLicence', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
          enabled: !busy, run: () => setEditor(0) },
        { key: 'WebEditLicence', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
          enabled, run: () => { if (row) setEditor(row.id); } },
        { key: 'WebDeleteLicence', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
          enabled, run: () => { if (row) return remove(row); } },
        exportAction(rows, !busy),
        { key: 'WebViewLicence', label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView,
          enabled, run: () => { if (row) setTarget(row); } },
      ];
    }}>
      {rows => <DataTable label={title} columns={columns} rows={rows} rowId={row => row.id} resizable
        selected={selected} onSelect={canView || canEdit || canDelete ? row => select(row.id) : undefined} />}
    </RecordStatusResults>
    {target && canView && <LicenceDetail target={{ row: target }} onClose={() => setTarget(undefined)} />}
    {editor !== undefined && (editor ? canEdit : canAdd) &&
      <LicenceEditor id={editor || undefined} canEdit={canEdit} onClose={() => setEditor(undefined)} onSaved={refresh} />}
  </Page>;
}
