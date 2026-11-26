import { useCallback, type ReactNode } from 'react';
import { useSession } from '@/app/session';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable } from '@/shared/ui/data-table';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Modal } from '@/shared/ui/primitives';
import { getLicence, getCustomerLicence, type CustomerLicenceRow, type LicenceRow } from './licence-api';

export function LicenceDetail({ target, onClose }: {
  target: { row: LicenceRow } | { row: CustomerLicenceRow; customerId: number };
  onClose: () => void;
}) {
  const { http } = useSession();
  const { t, date } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const yesNo = (value: boolean) => core(value ? 'Yes' : 'No');
  const id = target.row.id;
  const customerId = 'customerId' in target ? target.customerId : undefined;
  const load = useCallback(async (signal: AbortSignal) => customerId !== undefined
    ? { kind: 'customer' as const, detail: await getCustomerLicence(http, customerId, id, signal) }
    : { kind: 'licence' as const, detail: await getLicence(http, id, signal) }, [http, id, customerId]);
  const result = useResource(load);
  const entry = result.state === 'ready' ? result.data : undefined;
  const detail = entry?.detail;
  const general: [string, ReactNode][] = [];
  if (entry?.kind === 'customer' && 'customerId' in target) {
    general.push([core('Type'), target.row.licenceTypeName || entry.detail.licenceTypeId],
      [core('Licence'), target.row.licenceName || entry.detail.licenceId],
      [core('StartDate'), date(entry.detail.startDate)], [core('EndDate'), date(entry.detail.endDate)],
      [core('UserCount'), entry.detail.maxUserCount], [core('Trial'), yesNo(entry.detail.isTrial)]);
  } else if (entry?.kind === 'licence') general.push([core('Licence'), entry.detail.licenceName || '–']);
  return <Modal title={target.row.licenceName || core('Licence')} workspace onClose={onClose}>
    {entry && detail ? <div className="grid gap-2">
      <PageGroup title={core('General')}>
        <DefinitionList compact items={[
          [core('Id'), detail.id], ...general,
          [core('AdditionalPeriodAsDays'), detail.additionalPeriodAsDays], [core('Description'), detail.description || '–'],
        ]} />
      </PageGroup>
      {entry.kind === 'licence' && <PageGroup title={core('Applications')}>
        <DataTable label={core('Applications')} rows={entry.detail.licenceApplications ?? []} rowId={row => row.id}
          columns={[
            { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
            { key: 'application', title: core('Application'), render: row => row.applicationName || row.applicationId },
            { key: 'active', title: core('Active'), render: row => yesNo(row.isActive) },
            { key: 'deleted', title: core('Deleted'), render: row => yesNo(row.isDeleted) },
          ]} resizable />
      </PageGroup>}
      <PageGroup title={core('Status')}>
        <DefinitionList compact items={[[core('Active'), yesNo(detail.isActive)], [core('Deleted'), yesNo(detail.isDeleted)]]} />
      </PageGroup>
      <PageGroup title={core('Details')}>
        <DefinitionList compact items={[[core('InsertedBy'), detail.insertedBy ?? '–'], [core('InsertedDate'), date(detail.insertedDate)],
          [core('UpdatedBy'), detail.updatedBy ?? '–'], [core('UpdatedDate'), date(detail.updatedDate)]]} />
      </PageGroup>
    </div> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}
