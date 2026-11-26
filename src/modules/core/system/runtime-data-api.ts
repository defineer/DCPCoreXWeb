import { z } from 'zod';
import { genericResponse } from '@/shared/contracts';
import { confirmCommand, withQuery, type HttpClientManager } from '@/shared/http';

const base = '/api/';
const cacheKey = z.object({ key: z.string() });
const count = z.number().int();
const queueResource = z.object({ queueName: z.string(), elementCount: count });
const tableResource = z.object({ tableName: z.string(), elementCount: count });
const item = z.object({ key: z.string(), itemValue: z.string().nullish() });
export interface RuntimeResource { name: string; count?: number; canAccess: boolean }
export type RuntimeItem = z.infer<typeof item>;
export type RuntimeKind = 'cache' | 'queues' | 'tables';

export async function loadRuntimeCatalog(http: HttpClientManager, kind: RuntimeKind, type: number, signal: AbortSignal):
  Promise<{ rows: RuntimeResource[]; canClear: boolean }> {
  if (kind === 'cache') {
    const keys = await http.json(base + 'cacheservice/getallitems', z.array(cacheKey), { signal });
    return { rows: keys.map(item => ({ name: item.key, canAccess: true })), canClear: true };
  }
  const rows = kind === 'queues'
    ? (await http.json(base + 'queueservice/getqueuelist', z.array(queueResource), {
      method: 'POST', signal, body: { queueType: type },
    })).map(item => ({ name: item.queueName, count: item.elementCount, canAccess: true }))
    : (await http.json(base + 'memorytableservice/gettablelist', z.array(tableResource), { signal }))
      .map(item => ({ name: item.tableName, count: item.elementCount, canAccess: true }));
  return { rows, canClear: false };
}

export async function loadCacheValue(http: HttpClientManager, key: string, signal: AbortSignal) {
  return { value: await http.json(withQuery(base + 'cacheservice/getcacheitem', { key }), z.unknown(), { signal }) };
}

export async function runtimeCommand(http: HttpClientManager, path: string,
  query?: Record<string, string>, body?: { name?: string; itemValue?: string; key?: string; sourceQueueName?: string; destinationQueueName?: string }) {
  const [kind, group, action] = path.split('/');
  const queue = kind === 'queues';
  const service = kind === 'cache' ? 'cacheservice/' : queue ? 'queueservice/' : 'memorytableservice/';
  const nameKey = queue ? 'queueName' : 'tableName';
  let operation: string;
  let parameters: Record<string, string> | undefined;
  let payload: object | undefined;
  if (kind === 'cache') {
    operation = group === 'clear' ? 'clearcache' : 'deletecacheitem';
    parameters = query;
  } else if (group === 'move') {
    operation = 'movequeue';
    parameters = { sourceQueueName: body?.sourceQueueName ?? '', destinationQueueName: body?.destinationQueueName ?? '' };
  } else if (group === 'resource') {
    operation = action + (queue ? 'queue' : 'table');
    parameters = { [nameKey]: query?.name ?? '' };
  } else {
    operation = action + (queue ? 'queueitem' : 'tablerow');
    if (action === 'save') payload = { [nameKey]: body?.name, key: body?.key, itemValue: body?.itemValue };
    else parameters = { [nameKey]: query?.name ?? '', key: query?.key ?? '' };
  }
  const endpoint = base + service + operation;
  confirmCommand(await http.json(parameters ? withQuery(endpoint, parameters) : endpoint,
    genericResponse, { method: 'POST', body: payload }));
}

export function loadRuntimeItems(http: HttpClientManager, kind: Exclude<RuntimeKind, 'cache'>, name: string, signal: AbortSignal) {
  return kind === 'queues'
    ? http.json(base + 'queueservice/getqueueitemlist', z.array(item), { method: 'POST', signal, body: { queueName: name } })
    : http.json(base + 'memorytableservice/gettablerowlist', z.array(item), { method: 'POST', signal, body: { tableName: name } });
}
