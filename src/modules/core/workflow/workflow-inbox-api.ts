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
  canExecuteActions: z.boolean(), canRestart: z.boolean().optional(), isTerminalState: z.boolean(),
  isInitialState: z.boolean(), allowsDelegation: z.boolean(),
  currentStateId: z.number().int(), currentNodeNumber: z.number().int(), currentWorkflowTypeStateId: z.number().int(),
});
const transition = z.object({
  selectionId: z.number().int(), stateId: z.number().int(), workflowTypeStateId: z.number().int(), nodeNumber: z.number().int(),
  workflowTypeStateTransitionId: z.number().int(), stateName: text, stateKeyName: text, isDefault: z.boolean(),
});
const history = z.object({
  workflowAction: z.union([z.string(), z.number()]), stateName: text, startDate: z.string(), userName: text,
  responsibleRoleName: text, responsibleWorkgroupName: text, executedByUserName: text, description: text,
});
export type WorkflowInboxItem = z.infer<typeof status>;
export type WorkflowTarget = Pick<WorkflowInboxItem,
  'workflowObjectId' | 'workflowObjectTransitionId' | 'objectId' | 'objectTypeId' | 'workflowTypeId' |
  'currentStateId' | 'currentNodeNumber' | 'currentWorkflowTypeStateId' | 'canExecuteActions' | 'canRestart' |
  'isTerminalState' | 'isInitialState' | 'allowsDelegation'>;
export type WorkflowHistoryItem = z.infer<typeof history>;
export const workflowActionCode = {
  Next: 0, Previous: 1, Restart: 2, Cancelled: 3, Completed: 4, Delegate: 6,
} as const;
export type WorkflowAction = keyof typeof workflowActionCode;
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
export async function getWorkflowChoices(http: HttpClientManager, row: WorkflowTarget, action: WorkflowAction, signal: AbortSignal) {
  let choices: Transition[] = [];
  let users: z.infer<typeof simpleData>[] = [];
  if (action === 'Next' || action === 'Previous' || action === 'Completed' || action === 'Cancelled') {
    choices = await http.json(withQuery(base + (action === 'Previous' ? 'getpreviousstates' : 'getnextstates'), {
      workflowTypeId: row.workflowTypeId, currentStateId: row.currentStateId, nodeNumber: row.currentNodeNumber,
      ...(action === 'Completed' || action === 'Cancelled' ? { workflowAction: workflowActionCode[action] } : {}),
    }), z.array(transition), { signal });
  } else if (action === 'Restart') {
    choices = [await http.json(withQuery(base + 'getinitialstate', { workflowTypeId: row.workflowTypeId }), transition, { signal })];
  } else if (action === 'Delegate') {
    users = await http.json('/api/userservice/getuserssimple', z.array(simpleData), { signal });
  }
  return { choices, users };
}
export async function changeWorkflow(http: HttpClientManager, row: WorkflowTarget, action: WorkflowAction,
  selected: Transition | undefined, newResponsibleUserId: number | undefined, description: string) {
  confirmCommand(await http.json(base + 'changeworkflowstate', genericResponse, {
    method: 'POST',
    body: {
      workflowAction: workflowActionCode[action], workflowObjectId: row.workflowObjectId, domainObjectId: row.objectId,
      currentWorkflowObjectTransitionId: row.workflowObjectTransitionId, objectTypeId: row.objectTypeId,
      workflowTypeId: row.workflowTypeId, currentStateId: row.currentStateId, currentNodeNumber: row.currentNodeNumber,
      currentWorkflowTypeStateId: row.currentWorkflowTypeStateId, newStateId: selected?.stateId ?? row.currentStateId,
      newWorkflowTypeStateId: selected?.workflowTypeStateId ?? 0, nodeNumber: selected?.nodeNumber ?? row.currentNodeNumber,
      workflowTypeStateTransitionId: selected?.workflowTypeStateTransitionId ?? 0, newResponsibleUserId, description,
    },
  }));
}
