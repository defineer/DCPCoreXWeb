import type { ReactNode } from 'react';
import { recordStatus, type RecordStatus } from '../contracts';
import { useGlobalization } from '../globalization';
import { Button, SelectField, WorkspaceIcon } from './primitives';

export function RecordStatusQuery({ value, disabled, searchLabel, onChange, onSearch, children }: {
  value: RecordStatus; disabled?: boolean; searchLabel?: string; children?: ReactNode;
  onChange: (value: RecordStatus) => void; onSearch: () => void;
}) {
  const { t } = useGlobalization();
  return <form className="workspace-record-status-query workspace-fields" onSubmit={event => {
    event.preventDefault();
    if (!disabled) onSearch();
  }}>
    <SelectField label={t('RecordStatus', undefined, 'Core')} value={value} disabled={disabled}
      options={[
        { value: recordStatus.all, label: t('Common.All') },
        { value: recordStatus.active, label: t('ActiveRecords', undefined, 'Core') },
        { value: recordStatus.inactive, label: t('InActiveRecords', undefined, 'Core') },
        { value: recordStatus.deleted, label: t('Common.DeletedStatus') },
      ]}
      onChange={value => {
        const next = Object.values(recordStatus).find(status => String(status) === value);
        if (next !== undefined) onChange(next);
      }} />
    {children}
    <Button type="submit" disabled={disabled} aria-label={searchLabel} className="workspace-search">
      <WorkspaceIcon name="search" />{t('Search', undefined, 'Core')}
    </Button>
  </form>;
}
