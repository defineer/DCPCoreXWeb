import { z } from 'zod';
import { genericResponse, simpleData } from '@/shared/contracts';
import { confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const base = '/api/workflow/';
const id = z.string().regex(/^[0-9]+$/);
const text = z.string().nullish();
const status = z.object({
  workflowObjectId: id, workflowObjectTransitionId: id, objectId: id, workflowTypeId: z.number().int(),
  objectTypeId: z.number().int(), objectTypeName: text, currentNodeName: text, currentStateName: text,
  responsibleUserName: text, responsibleRoleName: text, responsibleWorkgroupName: text, workPageUrl: text,
  canExecuteActions: z.boolean(), isTerminalState: z.boolean(), isInitialState: z.boolean(), allowsDelegation: z.boolean(),
  currentStateId: z.number().int(), currentNodeNumber: z.number().int(), currentWorkflowTypeStateId: z.number().int(),
});
const transition = z.object({
  selectionId: z.number().int(), stateId: z.number().int(), workflowTypeStateId: z.number().int(), nodeNumber: z.number().int(),
  workflowTypeStateTransitionId: z.number().int(), stateName: text, isDefault: z.boolean(),
});
const history = z.object({
  workflowAction: z.union([z.string(), z.number()]), stateName: text, startDate: z.string(), userName: text,
  responsibleRoleName: text, responsibleWorkgroupName: text, executedByUserName: text, description: text,
});
export type WorkflowInboxItem = z.infer<typeof status>;
export type WorkflowHistoryItem = z.infer<typeof history>;
export const workflowActions = {
  Next: { value: 0, grant: 'WebWorkflowInboxNext' },
  Previous: { value: 1, grant: 'WebWorkflowInboxPrevious' },
  Restart: { value: 2, grant: 'WebWorkflowInboxRestart' },
  Cancelled: { value: 3, grant: 'WebWorkflowInboxCancel' },
  Completed: { value: 4, grant: 'WebWorkflowInboxCompleted' },
  Delegate: { value: 6, grant: 'WebWorkflowInboxDelegate' },
} as const;
export type WorkflowAction = keyof typeof workflowActions;
type Transition = z.infer<typeof transition>;

export function getInbox(http: HttpClientManager, workflowStatusListType: number, signal: AbortSignal) {
  return http.json(base + 'getworkflowinbox', z.array(status), {
    method: 'POST', body: { workflowStatusListType }, signal,
    exactIntegerFields: ['workflowObjectId', 'workflowObjectTransitionId', 'objectId'],
  });
}
export function getWorkflowHistory(http: HttpClientManager, workflowObjectId: string, signal: AbortSignal) {
  return http.json(withQuery(base + 'getobjectworkflowhistory', { workflowObjectId }), z.array(history), { signal });
}
export async function getWorkflowChoices(http: HttpClientManager, row: WorkflowInboxItem, action: WorkflowAction, signal: AbortSignal) {
  let choices: Transition[] = [];
  let users: z.infer<typeof simpleData>[] = [];
  if (action === 'Next' || action === 'Previous') {
    choices = await http.json(withQuery(base + (action === 'Next' ? 'getnextstates' : 'getpreviousstates'), {
      workflowTypeId: row.workflowTypeId, currentStateId: row.currentStateId, nodeNumber: row.currentNodeNumber,
    }), z.array(transition), { signal });
  } else if (action === 'Restart') {
    choices = [await http.json(withQuery(base + 'getinitialstate', { workflowTypeId: row.workflowTypeId }), transition, { signal })];
  } else if (action === 'Delegate') {
    users = await http.json('/api/userservice/getuserssimple', z.array(simpleData), { signal });
  }
  return { choices, users };
}
export async function changeWorkflow(http: HttpClientManager, row: WorkflowInboxItem, action: WorkflowAction,
  selected: Transition | undefined, newResponsibleUserId: number | undefined, description: string) {
  const customState = action === 'Completed' ? 7 : action === 'Cancelled' ? 6 : row.currentStateId;
  confirmCommand(await http.json(base + 'changeworkflowstate', genericResponse, {
    method: 'POST',
    body: {
      workflowAction: workflowActions[action].value, workflowObjectId: row.workflowObjectId, domainObjectId: row.objectId,
      currentWorkflowObjectTransitionId: row.workflowObjectTransitionId, objectTypeId: row.objectTypeId,
      workflowTypeId: row.workflowTypeId, currentStateId: row.currentStateId, currentNodeNumber: row.currentNodeNumber,
      currentWorkflowTypeStateId: row.currentWorkflowTypeStateId, newStateId: selected?.stateId ?? customState,
      newWorkflowTypeStateId: selected?.workflowTypeStateId ?? 0, nodeNumber: selected?.nodeNumber ?? row.currentNodeNumber,
      workflowTypeStateTransitionId: selected?.workflowTypeStateTransitionId ?? 0, newResponsibleUserId, description,
    },
  }));
}
