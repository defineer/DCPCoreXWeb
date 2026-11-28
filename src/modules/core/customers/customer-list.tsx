import { useCallback, useRef, useState } from 'react';
import { ClipboardList, UserCog } from 'lucide-react';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page } from '@/shared/ui/page';
import { Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { useTableExport } from '@/shared/ui/table-export-action';
import { toast } from '@/shared/ui/toasts';
import { CustomerLicenceList } from '../licences/customer-licence-list';
import { deleteCustomer, getCustomers, getCustomerTypes, type CustomerRow } from './customer-api';
import { CustomerEditor, type CustomerTarget } from './customer-editor';
import { CustomerAdministratorSetup } from './customer-administrator-setup';

const allCustomerTypes = -1;

export function CustomerList() {
  const { http, state } = useSession();
  const { canPage, canAction } = useWorkspace();
  const { t, error } = useGlobalization();
  const confirm = useDialogManager();
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const [customerType, setCustomerType] = useState(allCustomerTypes);
  const [selectedId, select] = useState<number>();
  const [licences, setLicences] = useState<CustomerRow>();
  const [target, setTarget] = useState<CustomerTarget>();
  const [setup, setSetup] = useState<CustomerRow>();
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Customers');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getCustomers(http, status, customerType, signal), [http, customerType]);
  const loadTypes = useCallback((signal: AbortSignal) =>
    common ? getCustomerTypes(http, signal) : Promise.resolve([]), [common, http]);
  const types = useResource(loadTypes);
  const canLicences = common && canPage('WebCustomerLicenceList') && canAction('WebCustomerList', 'WebListCustomerLicences');
  const canView = canPage('WebCustomerEdit') && canAction('WebCustomerList', 'WebViewCustomer');
  const canEdit = canAction('WebCustomerList', 'WebEditCustomer') && canAction('WebCustomerEdit', 'WebSaveCustomer');
  const canAdd = common && canPage('WebCustomerEdit') && canAction('WebCustomerEdit', 'WebSaveCustomer')
    && canAction('WebCustomerList', 'WebAddCustomer');
  const canDelete = canAction('WebCustomerList', 'WebDeleteCustomer');
  const columns = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.customerName || '–' },
    { key: 'type', title: core('Type'), render: row => row.customerTypeName || '–' },
    { key: 'phone', title: core('Phone'), render: row => row.phone || '–' },
    { key: 'infoEmail', title: core('InfoEmail'), render: row => row.infoEmail || '–' },
  ] satisfies Column<CustomerRow>[];
  const exportAction = useTableExport<CustomerRow>('customers', columns);
  const typeOptions = types.state === 'ready' ? types.data.map(type => ({ value: type.id, label: type.name || String(type.id) })) : [];
  const refresh = () => setReload(value => value + 1);

  async function remove(row: CustomerRow) {
    if (!canDelete || deleting.current) return;
    deleting.current = true;
    setBusy(true);
    try {
      if (!await confirm({ message: t('Common.DeleteConfirm', { name: row.customerName || row.id }),
        accept: core('Delete'), reject: core('Cancel') })) return;
      await deleteCustomer(http, row.id);
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

  return <Page id="CustomerList" title={title}>
    <RecordStatusResults title={title} operation="CustomerList" load={load} showQuery={common} reloadVersion={reload}
      filters={<SelectField label={core('Type')} value={customerType} disabled={types.state !== 'ready'}
        options={[{ value: allCustomerTypes, label: t('Common.All') }, ...typeOptions]}
        error={types.state === 'error' ? t('Common.Failed') : undefined}
        onChange={value => { setCustomerType(Number(value)); select(undefined); }} />}
      actions={rows => {
        const row = rows.find(customer => customer.id === selectedId);
        const enabled = Boolean(row) && !busy;
        return [
          { key: 'WebAddCustomer', label: core('New'), icon: <WorkspaceIcon name="add" />, allowed: canAdd, enabled: !busy,
            run: () => setTarget({ mode: 'new' }) },
          { key: 'WebViewCustomer', label: core('View'), icon: <WorkspaceIcon name="view" />, allowed: canView, enabled,
            run: () => { if (row) setTarget({ row, mode: 'view' }); } },
          { key: 'WebEditCustomer', label: core('Edit'), icon: <WorkspaceIcon name="edit" />, allowed: canEdit, enabled,
            run: () => { if (row) setTarget({ row, mode: 'edit' }); } },
          { key: 'WebDeleteCustomer', label: core('Delete'), icon: <WorkspaceIcon name="delete" />, allowed: canDelete, enabled,
            run: () => { if (row) return remove(row); } },
          { key: 'WebListCustomerLicences', label: core('Licences'), icon: <ClipboardList />,
            allowed: canLicences, enabled, run: () => { if (row) setLicences(row); } },
          { key: 'administrator-setup', label: t('Customer.AdministratorSetup'), icon: <UserCog aria-hidden="true" />,
            allowed: canAdd, enabled, run: () => { if (row) setSetup(row); } },
          exportAction(rows, !busy),
        ];
      }}>
      {rows => <DataTable label={title} columns={columns} rows={rows} rowId={row => row.id}
        selected={selectedId} onSelect={row => select(row.id)} resizable />}
    </RecordStatusResults>
    {target && (target.mode === 'new' ? canAdd : target.mode === 'edit' ? canEdit : canView) &&
      <CustomerEditor target={target} canEdit={canEdit} canView={canView}
        onClose={() => setTarget(undefined)} onSaved={refresh} />}
    {licences && canLicences && <Modal title={(licences.customerName || String(licences.id)) + ' - ' + core('Licences')}
      workspace onClose={() => setLicences(undefined)}>
      <CustomerLicenceList customerId={licences.id} />
    </Modal>}
    {setup && canAdd && <CustomerAdministratorSetup customer={setup} onClose={() => setSetup(undefined)} />}
  </Page>;
}
