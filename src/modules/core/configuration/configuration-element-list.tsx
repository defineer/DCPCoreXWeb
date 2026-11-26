import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { Page, StatusPanel } from '@/shared/ui/page';
import { Modal, SelectField } from '@/shared/ui/primitives';
import { RecordStatusResults } from '@/shared/ui/record-status-results';
import { CatalogList, type CatalogColumn } from './configuration-catalog-list';
import { ConfigurationElementEditor } from './configuration-element-editor';
import { deleteConfigurationElement, getConfigurationElementChoices, getConfigurationElements,
  getConfigurationVersionMetadata, type ConfigurationElementRow, type ConfigurationVersion } from './configuration-element-api';

export function ConfigurationElementList() {
  return <ElementCatalog tree={false} />;
}

export function ConfigurationElementTreeList() {
  return <ElementCatalog tree />;
}

function ElementCatalog({ tree }: { tree: boolean }) {
  const { http, state } = useSession();
  const { canPage, canAction } = useWorkspace();
  const { t } = useGlobalization();
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState(0);
  const [versionElement, setVersionElement] = useState<ConfigurationElementRow>();
  const core = (key: string) => t(key, undefined, 'Core');
  const title = tree ? t('Configuration.ElementTree') : core('ConfigurationElements');
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const subject = tree ? 'ConfigurationElementTree' : 'ConfigurationElement';
  const versions = 'WebListVersions' + subject;
  const canListVersions = canAction('Web' + subject + 'List', versions) && canPage('WebConfigurationElementVersionList');
  const loadChoices = useCallback((signal: AbortSignal) => common
    ? getConfigurationElementChoices(http, tree, signal) : Promise.resolve({ types: [], licenceTypes: [] }),
  [common, http, tree]);
  const choices = useResource(loadChoices);
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getConfigurationElements(http, tree, typeId, status, signal), [http, tree, typeId]);
  const columns: CatalogColumn<ConfigurationElementRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.elementName || '–' },
    { key: 'parent', title: core('Parent'), render: row => row.parentElementName || '–' },
    { key: 'type', title: core('Type'), render: row => row.typeName || '–' },
    { key: 'key', title: core('KeyName'), render: row => row.keyName || '–' },
    { key: 'licence', title: core('LicenceType'), render: row => row.licenceTypeName || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];
  return <Page id={subject + 'List'} title={title}>
    {!common ? <StatusPanel kind="denied" /> : choices.state === 'error'
      ? <StatusPanel kind="error" error={choices.error} retry={choices.refresh} /> : choices.state === 'loading'
        ? <StatusPanel kind="loading" /> : <CatalogList title={title} subject={subject} filename="configuration-elements"
          editorPage="WebConfigurationElementEdit" saveAction="WebSaveConfigurationElement" load={load} columns={columns}
          requiresParent={row => row.isActive} treeParent={tree ? row => row.parentConfigurationElementId ?? 0 : undefined}
          name={row => row.elementName || String(row.id)} onRemove={row => deleteConfigurationElement(http, tree, row.id)}
          renderEditor={(target, canEdit, close, refresh) => <ConfigurationElementEditor target={target} tree={tree}
            choices={choices.data} canEdit={canEdit} onClose={close} onSaved={refresh} />}
          related={canListVersions ? { open: setVersionElement, key: versions, label: core('Versions') } : undefined}
          filters={!tree && <SelectField label={core('Type')} value={typeId} onChange={value => setTypeId(Number(value))}
            options={[{ value: 0, label: core('All') }, ...choices.data.types.map(type => ({
              value: type.id, label: type.name || String(type.id),
            }))]} />}
          onClose={() => navigate('/index')} />}
    {common && canListVersions && versionElement &&
      <ConfigurationVersionDialog tree={tree} element={versionElement} onClose={() => setVersionElement(undefined)} />}
  </Page>;
}

function ConfigurationVersionDialog({ tree, element, onClose }: {
  tree: boolean; element: ConfigurationElementRow; onClose: () => void;
}) {
  const { http } = useSession();
  const { t, date } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Configuration.VersionMetadata');
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getConfigurationVersionMetadata(http, tree, element.id, status, signal), [http, tree, element.id]);
  const columns: Column<ConfigurationVersion>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'customer', title: core('CustomerId'), render: row => row.customerId, numeric: true },
    { key: 'version', title: core('Version'), render: row => row.version || '–' },
    { key: 'schema', title: core('Schema'), render: row => row.configurationElementTypeSchemaVersionId, numeric: true },
    { key: 'versionDate', title: core('VersionDate'), render: row => date(row.versionDate) },
    { key: 'installed', title: core('InstalledDate'), render: row => date(row.installedDate) },
    { key: 'objectType', title: core('ObjectType'), render: row => row.objectTypeId, numeric: true },
    { key: 'object', title: core('Object'), render: row => row.objectId },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];
  return <Modal workspace title={(element.elementName || String(element.id)) + ' - ' + title} onClose={onClose}>
    <RecordStatusResults title={title} operation="ConfigurationElementVersionList" load={load}>
      {rows => <DataTable label={title} rows={rows} columns={columns} rowId={row => row.id} resizable />}
    </RecordStatusResults>
  </Modal>;
}
