import { useCallback, useState } from 'react';
import { matchPath, useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { PagedDataTable, ListPage } from '@/shared/ui/data-table';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { Button, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { coreRoutes } from '../routes';
import { getInbox, type WorkflowInboxItem } from './workflow-inbox-api';
import { useWorkflowActions } from './workflow-actions';

const page = 'WebWorkflowInbox';
const actionKeys = {
  history: 'WebWorkflowInboxHistory',
  Next: 'WebWorkflowInboxNext',
  Previous: 'WebWorkflowInboxPrevious',
  Restart: 'WebWorkflowInboxRestart',
  Cancelled: 'WebWorkflowInboxCancel',
  Completed: 'WebWorkflowInboxCompleted',
  Delegate: 'WebWorkflowInboxDelegate',
} as const;

export function WorkflowInbox() {
  const { http } = useSession();
  const { canAction, canPage } = useWorkspace();
  const { t, error } = useGlobalization();
  const navigate = useNavigate();
  const [status, setStatus] = useState(1);
  const [selection, select] = useState<string>();
  const load = useCallback((signal: AbortSignal) => getInbox(http, status, signal), [http, status]);
  const result = useResource(load);
  const rows = result.state === 'ready' ? result.data : [];
  const row = rows.find(item => item.workflowObjectId === selection);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Workflow.Inbox');
  const columns = [
    { key: 'objectType', title: core('ObjectType'), render: (item: WorkflowInboxItem) => item.objectTypeName || '–' },
    { key: 'object', title: t('Workflow.ObjectId'), render: (item: WorkflowInboxItem) => item.objectId },
    { key: 'node', title: t('Workflow.Node'), render: (item: WorkflowInboxItem) => item.currentNodeName || '–' },
    { key: 'state', title: core('State'), render: (item: WorkflowInboxItem) => item.currentStateName || '–' },
    { key: 'user', title: core('User'), render: (item: WorkflowInboxItem) => item.responsibleUserName || '–' },
    { key: 'role', title: core('Role'), render: (item: WorkflowInboxItem) => item.responsibleRoleName || '–' },
    { key: 'workgroup', title: t('Workflow.Workgroup'), render: (item: WorkflowInboxItem) => item.responsibleWorkgroupName || '–' },
  ];
  const workUrl = row?.workPageUrl;
  const workPath = workUrl?.split(/[?#]/, 1)[0];
  const destination = workPath && !workUrl?.includes('\\') && coreRoutes.find(({ path }) => matchPath(path, workPath));
  const url = destination && canPage(destination.pageKey) ? workUrl : undefined;
  const workflow = useWorkflowActions({
    http, row, grants: Object.fromEntries(Object.entries(actionKeys).filter(([, grant]) => canAction(page, grant))),
    onTransitionCompleted: () => { select(undefined); result.refresh(); },
  });
  return <Page id="WorkflowInbox" title={title}>
    <ListPage resultsTitle={title}
      tools={<Toolbar operation="WorkflowInbox" actions={[
        { key: 'WebOpenWorkflowObject', label: t('Workflow.Open'), allowed: canAction(page, 'WebOpenWorkflowObject'),
          enabled: Boolean(url), run: () => { if (url) navigate(url); } },
        ...workflow.toolbarActions,
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />, run: result.refresh },
        { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, 'workflow-inbox', [columns.map(column => column.title),
                ...rows.map(item => columns.map(column => column.render(item)))]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={<form className="workspace-record-status-query workspace-fields" onSubmit={event => {
        event.preventDefault();
        select(undefined);
        result.refresh();
      }}>
        <SelectField label={core('Status')} value={status} onChange={value => {
          select(undefined);
          setStatus(Number(value));
        }} options={[{ value: 0, label: core('All') }, { value: 1, label: core('Active') },
          { value: 2, label: core('Completed') }, { value: 3, label: core('Cancelled') }]} />
        <Button type="submit" className="workspace-search" disabled={result.state === 'loading'}>
          <WorkspaceIcon name="search" />{core('Query')}
        </Button>
      </form>}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <PagedDataTable onPageChange={() => select(undefined)} label={title} rows={rows} columns={columns} rowId={item => item.workflowObjectId} selected={selection}
            onSelect={item => select(item.workflowObjectId)} resizable />}
      </LoadingRegion>
    </ListPage>
    {workflow.dialog}
  </Page>;
}
