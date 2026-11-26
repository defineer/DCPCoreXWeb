import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import { exportTable } from '@/shared/export';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, ListPage, type Column } from '@/shared/ui/data-table';
import { LoadingRegion, Page, StatusPanel } from '@/shared/ui/page';
import { Button, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar, ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { changeWorkflow, getInbox, getWorkflowChoices, getWorkflowHistory, workflowActions,
  type WorkflowAction, type WorkflowHistoryItem, type WorkflowInboxItem } from './workflow-inbox-api';

const page = 'WebWorkflowInbox';
const actions = Object.keys(workflowActions) as WorkflowAction[];
const names = { Next: 'Next', Previous: 'Previous', Restart: 'Restart', Cancelled: 'Cancel', Delegate: 'Delegate' };
function supportedWorkUrl(value?: string | null) {
  return value && /^\/(?!\/)/.test(value) && !value.includes('\\') ? value : undefined;
}
function eligible(row: WorkflowInboxItem, action: WorkflowAction) {
  return row.canExecuteActions && (!row.isTerminalState || action === 'Restart') &&
    (action !== 'Previous' || !row.isInitialState) && (action !== 'Delegate' || row.allowsDelegation);
}

export function WorkflowInbox() {
  const { http } = useSession();
  const { canAction } = useWorkspace();
  const { t, error } = useGlobalization();
  const navigate = useNavigate();
  const [status, setStatus] = useState(1);
  const [selection, select] = useState<string>();
  const [history, setHistory] = useState<WorkflowInboxItem>();
  const [target, setTarget] = useState<{ row: WorkflowInboxItem; action: WorkflowAction }>();
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
    { key: 'workgroup', title: core('Workgroup'), render: (item: WorkflowInboxItem) => item.responsibleWorkgroupName || '–' },
  ];
  const url = supportedWorkUrl(row?.workPageUrl);
  return <Page id="WorkflowInbox" title={title}>
    <ListPage resultsTitle={title}
      tools={<Toolbar operation="WorkflowInbox" actions={[
        { key: 'WebOpenWorkflowObject', label: core('Open'), allowed: canAction(page, 'WebOpenWorkflowObject'),
          enabled: Boolean(url), run: () => { if (url) navigate(url); } },
        { key: 'WebWorkflowInboxHistory', label: t('Workflow.History'), allowed: canAction(page, 'WebWorkflowInboxHistory'),
          enabled: Boolean(row), run: () => { if (row) setHistory(row); } },
        ...actions.map(action => ({
          key: workflowActions[action].grant, label: action === 'Completed' ? t('Workflow.Complete') : core(names[action]),
          allowed: canAction(page, workflowActions[action].grant),
          enabled: row ? eligible(row, action) : false, run: () => { if (row && eligible(row, action)) setTarget({ action, row }); },
        })),
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, run: result.refresh },
        { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, 'workflow-inbox', [columns.map(column => column.title),
                ...rows.map(item => columns.map(column => column.render(item)))]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={<SelectField label={core('Status')} value={status} onChange={value => {
        select(undefined);
        setStatus(Number(value));
      }} options={[{ value: 0, label: core('All') }, { value: 1, label: core('Active') },
        { value: 2, label: core('Completed') }, { value: 3, label: core('Cancelled') }]} />}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <DataTable label={title} rows={rows} columns={columns} rowId={item => item.workflowObjectId} selected={selection}
            onSelect={item => select(item.workflowObjectId)} resizable />}
      </LoadingRegion>
    </ListPage>
    {history && canAction(page, 'WebWorkflowInboxHistory') &&
      <History row={history} onClose={() => setHistory(undefined)} />}
    {target && canAction(page, workflowActions[target.action].grant) && <Transition {...target}
      onClose={() => setTarget(undefined)} onSaved={() => { setTarget(undefined); select(undefined); result.refresh(); }} />}
  </Page>;
}

function History({ row, onClose }: { row: WorkflowInboxItem; onClose: () => void }) {
  const { http } = useSession();
  const { t, date } = useGlobalization();
  const id = row.workflowObjectId;
  const load = useCallback((signal: AbortSignal) => getWorkflowHistory(http, id, signal), [http, id]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const columns: Column<WorkflowHistoryItem>[] = [
    { key: 'action', title: core('Action'), render: item => String(item.workflowAction) },
    { key: 'state', title: core('State'), render: item => item.stateName },
    { key: 'date', title: core('StartDate'), render: item => date(item.startDate) },
    { key: 'user', title: core('User'), render: item => item.userName },
    { key: 'role', title: core('Role'), render: item => item.responsibleRoleName },
    { key: 'group', title: core('Workgroup'), render: item => item.responsibleWorkgroupName },
    { key: 'actor', title: t('Workflow.ChangedBy'), render: item => item.executedByUserName },
    { key: 'description', title: core('Description'), render: item => item.description },
  ];
  const title = t('Workflow.History');
  return <Modal workspace title={title} onClose={onClose}>
    {result.state === 'ready' ? <DataTable label={title} rows={result.data} columns={columns}
      rowId={item => [item.startDate, item.workflowAction, item.stateName].join('/')} resizable />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

function Transition({ row, action, onClose, onSaved }: {
  row: WorkflowInboxItem; action: WorkflowAction; onClose: () => void; onSaved: () => void;
}) {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => getWorkflowChoices(http, row, action, signal), [http, row, action]);
  const result = useResource(load);
  const form = useEditForm({ selection: 0, delegate: 0, description: '' });
  const core = (key: string) => t(key, undefined, 'Core');
  const title = action === 'Completed' ? t('Workflow.Complete') : core(names[action]);
  const close = () => { void form.requestClose(onClose); };
  const confirmState = action === 'Next' || action === 'Previous';
  async function submit() {
    if (result.state !== 'ready') return;
    const { choices } = result.data;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (confirmState && !choices.some(item => item.selectionId === value.selection)) errors.selection = t('Common.Required');
      if (action === 'Delegate' && !value.delegate) errors.delegate = t('Common.Required');
      return errors;
    }, async value => {
      await changeWorkflow(http, row, action, action === 'Restart' ? choices[0] : choices.find(item => item.selectionId === value.selection),
        action === 'Delegate' ? value.delegate : undefined, value.description);
      return value;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      onSaved();
    });
  }
  return <Modal workspace title={title} onClose={close}>
    {result.state === 'ready' ? <form className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <ToolbarBar>
        <Button type="submit" disabled={form.pending || (confirmState && !result.data.choices.length)}>{core('Save')}</Button>
        <Button disabled={form.pending} onClick={close}>{core('Close')}</Button>
      </ToolbarBar>
      <FormGroup title={title}>
        {confirmState && <SelectField label={core('State')} value={form.values.selection} disabled={form.pending}
          options={[{ value: 0, label: '–' }, ...result.data.choices.map(item => ({
            value: item.selectionId, label: item.stateName || String(item.stateId),
          }))]} onChange={value => form.change('selection', Number(value))} error={form.errors.selection} />}
        {action === 'Delegate' && <SelectField label={core('User')} value={form.values.delegate} disabled={form.pending}
          options={[{ value: 0, label: '–' }, ...result.data.users.map(item => ({ value: item.id, label: item.name || String(item.id) }))]}
          onChange={value => form.change('delegate', Number(value))} error={form.errors.delegate} />}
        <TextAreaField label={core('Description')} value={form.values.description} readOnly={form.pending}
          onChange={value => form.change('description', value)} />
      </FormGroup>
    </form> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}
