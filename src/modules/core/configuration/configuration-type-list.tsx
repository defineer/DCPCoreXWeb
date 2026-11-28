import { useCallback, useState } from 'react';
import { ListTree } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { RecordStatus } from '@/shared/contracts';
import { useFormStateService } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { Page, StatusPanel } from '@/shared/ui/page';
import { Modal } from '@/shared/ui/primitives';
import { CatalogList, type CatalogColumn } from './configuration-catalog-list';
import { ConfigurationSchemaEditor } from './configuration-schema-editor';
import { ConfigurationTypeEditor } from './configuration-type-editor';
import {
  deleteConfigurationSchema, deleteConfigurationType, getConfigurationSchemas, getConfigurationTypes,
  type ConfigurationSchemaRow, type ConfigurationTypeRow,
} from './configuration-type-api';

const typeKey = 'ConfigurationElementType';
const schemaKey = 'ConfigurationElementTypeSchemaVersion';
const schemaAction = 'WebViewConfigurationElementTypeSchemas';
const typePage = 'WebConfigurationElementTypeList';
const schemaPage = 'WebConfigurationElementTypeSchemaVersionList';

export function ConfigurationTypeList() {
  const { http, state } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t } = useGlobalization();
  const navigate = useNavigate();
  const [schemaType, setSchemaType] = useState<ConfigurationTypeRow>();
  const load = useCallback((status: RecordStatus, signal: AbortSignal) => getConfigurationTypes(http, status, signal), [http]);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('ConfigurationElementTypes');
  const common = state.stage === 'authenticated' && state.session.customerId === 0;
  const canViewSchemas = canAction(typePage, schemaAction) && canPage(schemaPage);
  const columns: CatalogColumn<ConfigurationTypeRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'name', title: core('Name'), render: row => row.typeName || '–' },
    { key: 'key', title: core('KeyName'), render: row => row.keyName || '–' },
    { key: 'parent', title: core('Parent'), render: row => row.parentTypeName || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];
  return <Page id={typeKey + 'List'} title={title}>
    {common ? <CatalogList title={title} subject={typeKey} filename="configuration-element-types"
      load={load} columns={columns} name={row => row.typeName || String(row.id)}
      onRemove={row => deleteConfigurationType(http, row.id)}
      renderEditor={(target, canEdit, canSave, close, refresh) =>
        <ConfigurationTypeEditor target={target} canEdit={canEdit} canSave={canSave} onClose={close} onSaved={refresh} />}
      onClose={() => navigate('/index')}
      related={canViewSchemas ? {
        open: setSchemaType, key: schemaAction, label: core('Schema'), icon: <ListTree aria-hidden="true" />,
      } : undefined} />
      : <StatusPanel kind="denied" />}
    {common && canViewSchemas && schemaType &&
      <TypeSchemas key={schemaType.id} type={schemaType} onClose={() => setSchemaType(undefined)} />}
  </Page>;
}

function TypeSchemas({ type, onClose }: { type: ConfigurationTypeRow; onClose: () => void }) {
  const { http } = useSession();
  const { allowLeave } = useFormStateService();
  const { t, date } = useGlobalization();
  const load = useCallback((status: RecordStatus, signal: AbortSignal) =>
    getConfigurationSchemas(http, type.id, status, signal), [http, type.id]);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = core('Versions');
  const typeName = type.typeName || String(type.id);
  const columns: CatalogColumn<ConfigurationSchemaRow>[] = [
    { key: 'id', title: core('Id'), render: row => row.id, numeric: true },
    { key: 'type', title: core('ConfigurationElementType'), render: () => typeName },
    { key: 'version', title: core('Version'), render: row => row.version || '–' },
    { key: 'date', title: core('VersionDate'), render: row => date(row.versionDate) },
    { key: 'schema', title: core('Schema'), render: row => row.contentSchema || '–' },
    { key: 'active', title: core('Active'), render: row => core(row.isActive ? 'Yes' : 'No') },
  ];
  return <Modal workspace title={typeName + ' - ' + title} onClose={() => {
    void allowLeave().then(allowed => { if (allowed) onClose(); });
  }}>
    <CatalogList title={title} subject={schemaKey} filename="configuration-schema-versions" allowAdd={type.isActive}
      load={load} columns={columns} name={row => row.version || String(row.id)}
      onRemove={row => deleteConfigurationSchema(http, type.id, row.id)}
      renderEditor={(target, canEdit, canSave, close, refresh) =>
        <ConfigurationSchemaEditor type={type} target={target} canEdit={canEdit} canSave={canSave} onClose={close} onSaved={refresh} />} />
  </Modal>;
}
