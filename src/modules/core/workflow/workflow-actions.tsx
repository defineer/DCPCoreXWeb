import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { HttpClientManager } from '@/shared/http';
import { exportTable } from '@/shared/export';
import { useEditForm, type FormErrors } from '@/shared/forms';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { PagedDataTable, type Column } from '@/shared/ui/data-table';
import { StatusPanel } from '@/shared/ui/page';
import { Button, FormGroup, Modal, SelectField, TextAreaField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar, ToolbarBar, type ToolbarAction } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { changeWorkflow, getWorkflowChoices, getWorkflowHistory,
  type WorkflowAction, type WorkflowHistoryItem, type WorkflowTarget } from './workflow-inbox-api';

const transitionLabels = {
  Next: 'Next', Previous: 'Previous', Restart: 'Restart', Cancelled: 'Cancel', Completed: 'Completed', Delegate: 'Delegate',
} satisfies Record<WorkflowAction, string>;
const actions = Object.keys(transitionLabels) as WorkflowAction[];
const historyActionKeys = ['Next', 'Previous', 'Restart', 'Cancelled', 'Completed', 'Assign', 'Delegate', 'Start'];
type ActionGrants = Partial<Record<'history' | WorkflowAction, string>>;
type DialogTarget = { row: WorkflowTarget; action: 'history' | WorkflowAction };
type WorkflowChoices = Awaited<ReturnType<typeof getWorkflowChoices>>;

function eligible(row: WorkflowTarget, action: WorkflowAction) {
  if (action === 'Restart') return !row.isInitialState && (row.canRestart ?? row.canExecuteActions);
  return row.canExecuteActions && !row.isTerminalState && (action !== 'Previous' || !row.isInitialState) &&
    (action !== 'Delegate' || row.allowsDelegation);
}

export function useWorkflowActions({ http, row, grants, canOpenTransition, onTransitionCompleted }: {
  http: HttpClientManager;
  row?: WorkflowTarget;
  grants: ActionGrants;
  canOpenTransition?: () => boolean | Promise<boolean>;
  onTransitionCompleted: () => void;
}) {
  const { t, error } = useGlobalization();
  const [target, setTarget] = useState<DialogTarget>();
  const opening = useRef(false);
  const close = () => setTarget(undefined);
  async function open(action: WorkflowAction) {
    if (!row || opening.current || !eligible(row, action)) return;
    opening.current = true;
    try {
      if (!canOpenTransition || await canOpenTransition()) setTarget({ row, action });
    } catch (failure) { toast.error(error(failure)); }
    finally { opening.current = false; }
  }
  const toolbarActions: ToolbarAction[] = [
    { key: grants.history ?? 'history', label: t('Workflow.History'), allowed: Boolean(grants.history), enabled: Boolean(row),
      run: () => { if (row) setTarget({ row, action: 'history' }); } },
    ...actions.map(action => ({
      key: grants[action] ?? action,
      label: action === 'Completed' ? t('Workflow.Complete') : t(transitionLabels[action], undefined, 'Core'),
      allowed: Boolean(grants[action]), enabled: Boolean(row && eligible(row, action)), run: () => open(action),
    })),
  ];
  let dialog: ReactNode = null;
  if (target && row && grants[target.action] && row.workflowObjectId === target.row.workflowObjectId) {
    const { action } = target;
    if (action === 'history') {
      dialog = <WorkflowHistory http={http} workflowObjectId={row.workflowObjectId} onClose={close} />;
    } else if (row.workflowObjectTransitionId === target.row.workflowObjectTransitionId && eligible(row, action)) {
      dialog = <WorkflowTransition key={row.workflowObjectTransitionId + '/' + action}
        http={http} row={target.row} action={action} onClose={close}
        onSaved={() => { close(); onTransitionCompleted(); }} />;
    }
  }
  return { toolbarActions, dialog };
}

function WorkflowHistory({ http, workflowObjectId, onClose }: {
  http: HttpClientManager; workflowObjectId: string; onClose: () => void;
}) {
  const { t, date, error } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => getWorkflowHistory(http, workflowObjectId, signal), [http, workflowObjectId]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('Workflow.History');
  const historyColumns = [
    { key: 'action', title: core('Action'), value: (item: WorkflowHistoryItem) => {
      const key = typeof item.workflowAction === 'number' ? historyActionKeys[item.workflowAction] : item.workflowAction;
      return key ? core(key) : String(item.workflowAction);
    } },
    { key: 'state', title: core('State'), value: (item: WorkflowHistoryItem) => item.stateName },
    { key: 'stateKey', title: core('KeyName'), value: (item: WorkflowHistoryItem) => item.stateKeyName },
    { key: 'date', title: core('StartDate'), value: (item: WorkflowHistoryItem) => date(item.startDate) },
    { key: 'user', title: core('User'), value: (item: WorkflowHistoryItem) => item.userName },
    { key: 'role', title: core('Role'), value: (item: WorkflowHistoryItem) => item.responsibleRoleName },
    { key: 'group', title: core('Workgroup'), value: (item: WorkflowHistoryItem) => item.responsibleWorkgroupName },
    { key: 'actor', title: t('Workflow.ChangedBy'), value: (item: WorkflowHistoryItem) => item.executedByUserName },
    { key: 'description', title: core('Description'), value: (item: WorkflowHistoryItem) => item.description },
  ];
  const rows = result.state === 'ready' ? result.data.map((item, index) => ({ ...item, index })) : [];
  const columns: Column<(typeof rows)[number]>[] = historyColumns.map(({ value, ...column }) => ({ ...column, render: value }));
  return <Modal workspace title={title} onClose={onClose}>
    <Toolbar operation="WorkflowHistory" actions={[
      { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="refresh" />,
        enabled: result.state !== 'loading', run: result.refresh },
      { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
        actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
          try {
            await exportTable(format, 'workflow-history', [historyColumns.map(column => column.title),
              ...rows.map(row => historyColumns.map(column => column.value(row) ?? ''))]);
          } catch (failure) { toast.error(error(failure)); }
        } })) },
    ]} />
    {result.state === 'ready' ? <PagedDataTable label={title} rows={rows} columns={columns} rowId={item => item.index} resizable />
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}

type WorkflowTransitionProps = {
  http: HttpClientManager; row: WorkflowTarget; action: WorkflowAction; onClose: () => void; onSaved: () => void;
};

function WorkflowTransition(props: WorkflowTransitionProps) {
  const { http, row, action, onClose } = props;
  const { t } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => getWorkflowChoices(http, row, action, signal), [http, row, action]);
  const result = useResource(load);
  const title = action === 'Completed' ? t('Workflow.Complete') : t(transitionLabels[action], undefined, 'Core');
  if (result.state === 'ready') return <WorkflowTransitionForm {...props} title={title} data={result.data} />;
  return <Modal workspace title={title} onClose={onClose}>
    {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
      : <StatusPanel kind="loading" />}
  </Modal>;
}

function WorkflowTransitionForm({ http, row, action, title, data, onClose, onSaved }:
  WorkflowTransitionProps & { title: string; data: WorkflowChoices }) {
  const { t, error } = useGlobalization();
  const { choices, users } = data;
  const needsDestination = action !== 'Delegate';
  const defaultChoice = choices.find(item => item.isDefault) ?? (action !== 'Previous' && choices.length === 1 ? choices[0] : undefined);
  const form = useEditForm({ selection: defaultChoice?.selectionId ?? 0, delegate: 0, description: '' });
  const core = (key: string) => t(key, undefined, 'Core');
  const close = () => { void form.requestClose(onClose); };
  const unavailable = needsDestination ? choices.length === 0 : users.length === 0;
  async function submit() {
    if (unavailable) return;
    await form.submit(value => {
      const errors: FormErrors = {};
      if (needsDestination && !choices.some(item => item.selectionId === value.selection)) errors.selection = t('Common.Required');
      if (!needsDestination && !users.some(item => item.id === value.delegate)) errors.delegate = t('Common.Required');
      return errors;
    }, async value => {
      await changeWorkflow(http, row, action, choices.find(item => item.selectionId === value.selection),
        action === 'Delegate' ? value.delegate : undefined, value.description);
      return value;
    }, failure => toast.error(error(failure, true)), () => {
      toast.success(t('Common.Saved'));
      onSaved();
    });
  }
  return <Modal workspace title={title} onClose={close}>
    <form className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <ToolbarBar>
        <Button type="submit" disabled={form.pending || unavailable}>{core('Save')}</Button>
        <Button disabled={form.pending} onClick={close}>{core('Close')}</Button>
      </ToolbarBar>
      {unavailable && <p role="status">{t('Common.Unavailable')}</p>}
      <FormGroup title={title}>
        {needsDestination ? <SelectField label={core('State')} value={form.values.selection} disabled={form.pending || unavailable}
          options={[{ value: 0, label: '–' }, ...choices.map(item => ({
            value: item.selectionId, label: item.stateName || String(item.stateId),
          }))]} onChange={value => form.change('selection', Number(value))} error={form.errors.selection} />
          : <SelectField label={core('User')} value={form.values.delegate} disabled={form.pending || unavailable}
            options={[{ value: 0, label: '–' }, ...users.map(item => ({ value: item.id, label: item.name || String(item.id) }))]}
            onChange={value => form.change('delegate', Number(value))} error={form.errors.delegate} />}
        <TextAreaField label={core('Description')} value={form.values.description} readOnly={form.pending}
          onChange={value => form.change('description', value)} />
      </FormGroup>
    </form>
  </Modal>;
}
