import { useCallback, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page, StatusPanel } from '@/shared/ui/page';
import { WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { useTableExport } from '@/shared/ui/table-export-action';
import { toast } from '@/shared/ui/toasts';
import { deleteCustomerLicence, getCustomerLicences, type CustomerLicenceRow } from './licence-api';
import { LicenceDetail } from './licence-detail';
import { CustomerLicenceEditor } from './customer-licence-editor';

export function CustomerLicenceList({ customerId }: { customerId: number }) {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, date, error } = useGlobalization();
  const confirm = useDialogManager();
  const [selected, select] = useState<number>();
  const [target, setTarget] = useState<CustomerLicenceRow>();
  const [editor, setEditor] = useState<number>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const canView = canPage('WebCustomerLicenceEdit') && canAction('WebCustomerLicenceList', 'WebViewCustomerLicence');
  const canSave = canAction('WebCustomerLicenceEdit', 'WebSaveCustomerLicence');
  const canAdd = canSave && canAction('WebCustomerLicenceList', 'WebAddCustomerLicence');
  const canEdit = canSave && canAction('WebCustomerLicenceList', 'WebEditCustomerLicence');
  const canDelete = canAction('WebCustomerLicenceList', 'WebDeleteCustomerLicence');
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Licences');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getCustomerLicences(http, customerId, status, signal), [http, customerId]);
  const refresh = () => setReload(value => value + 1);
  async function remove(row: CustomerLicenceRow) {
    if (deleting.current || !canDelete) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.licenceName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteCustomerLicence(http, customerId, row.id);
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
    { key: 'start', title: core('StartDate'), render: row => date(row.startDate) },
    { key: 'end', title: core('EndDate'), render: row => date(row.endDate) },
    { key: 'name', title: core('Licence'), render: row => row.licenceName || '–' },
    { key: 'type', title: core('Type'), render: row => row.licenceTypeName || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ] satisfies Column<CustomerLicenceRow>[];
  const exportAction = useTableExport<CustomerLicenceRow>('customer-licences', columns);
  return <>
    <RecordStatusResults title={title} operation="CustomerLicenceList" load={load} reloadVersion={reload} actions={rows => {
      const row = rows.find(item => item.id === selected);
      const enabled = Boolean(row) && !busy;
      return [
        { key: 'WebAddCustomerLicence', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd,
          enabled: !busy, run: () => setEditor(0) },
        { key: 'WebEditCustomerLicence', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit,
          enabled, run: () => { if (row) setEditor(row.id); } },
        { key: 'WebDeleteCustomerLicence', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete,
          enabled, run: () => { if (row) return remove(row); } },
        exportAction(rows, !busy),
        { key: 'WebViewCustomerLicence', label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView,
          enabled, run: () => { if (row) setTarget(row); } },
      ];
    }}>
      {rows => <DataTable label={title} columns={columns} rows={rows} rowId={row => row.id} resizable
        selected={selected} onSelect={canView || canEdit || canDelete ? row => select(row.id) : undefined} />}
    </RecordStatusResults>
    {target && canView && <LicenceDetail target={{ row: target, customerId }} onClose={() => setTarget(undefined)} />}
    {editor !== undefined && (editor ? canEdit : canAdd) && <CustomerLicenceEditor customerId={customerId} id={editor}
      canEdit={canEdit} onClose={() => setEditor(undefined)} onSaved={refresh} />}
  </>;
}

export function CustomerLicenceListPage() {
  const { state } = useSession();
  const { canAction } = useWorkspace();
  const { t } = useGlobalization();
  const [params] = useSearchParams();
  const ids = params.getAll('customerId');
  const id = ids.length === 1 && /^[1-9]\d*$/.test(ids[0]) ? Number(ids[0]) : 0;
  const authorized = state.stage === 'authenticated' && state.session.customerId === 0 &&
    canAction('WebCustomerList', 'WebListCustomerLicences');
  return <Page id="CustomerLicenceList" title={t('Licence.CustomerLicences')}>
    {authorized && <Link className="text-primary underline" to="/customerlistpage">{t('Customer.Management')}</Link>}
    {authorized && id > 0 && id <= 2147483647
      ? <CustomerLicenceList key={id} customerId={id} />
      : <StatusPanel kind={authorized ? 'missing' : 'denied'} />}
  </Page>;
}
