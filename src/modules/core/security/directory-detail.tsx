import { useCallback, type ReactNode } from 'react';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Modal } from '@/shared/ui/primitives';
import type { DirectoryDetail } from './directory-contract';

export function DirectoryDetailDialog({ title, id, load, onClose }: {
  title: string; id: number;
  load: (id: number, signal: AbortSignal) => Promise<DirectoryDetail>; onClose: () => void;
}) {
  const { t, date } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const query = useCallback((signal: AbortSignal) => load(id, signal), [load, id]);
  const result = useResource(query);
  const value = result.state === 'ready' ? result.data : undefined;
  const yesNo = (value: boolean) => core(value ? 'Yes' : 'No');
  const parent: [string, ReactNode][] = value?.parent ? [
    [core('ParentId'), value.parent.id || '–'], [core('Parent'), value.parent.name || '–'],
  ] : [];

  return <Modal title={title} workspace onClose={onClose}>
    {value ? <div className="grid gap-2">
      <PageGroup title={core('General')}>
        <DefinitionList compact items={[
          [core('Id'), value.id],
          ...parent,
          [core('Name'), value.name || '–'], [core('KeyName'), value.keyName || '–'], [core('Description'), value.description || '–'],
        ]} />
      </PageGroup>
      <PageGroup title={core('Status')}>
        <DefinitionList compact items={[[core('Active'), yesNo(value.isActive)], [core('Deleted'), yesNo(value.isDeleted)]]} />
      </PageGroup>
      <PageGroup title={core('Details')}>
        <DefinitionList compact items={[
          [core('InsertedBy'), value.insertedBy ?? '–'], [core('InsertedDate'), date(value.insertedDate)],
          [core('UpdatedBy'), value.updatedBy ?? '–'], [core('UpdatedDate'), date(value.updatedDate)],
        ]} />
      </PageGroup>
    </div> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}
