import { z } from 'zod';
import { simpleData } from '@/shared/contracts';
import { withQuery, type HttpClientManager } from '@/shared/http';

const base = '/api/aiframework/';
const exact = z.string().regex(/^-?[0-9]+$/);
const text = z.string().nullish();
const count = z.object({ name: z.string(), count: z.number() });
const breakdown = z.object({ category: text, series: text, count: z.number() });
const frameworks = z.object({
  summary: z.object({ totalCommands: z.number(), totalInputUnits: exact, totalOutputUnits: exact, averageDurationMs: z.number() }),
  commands: z.array(count), units: z.array(count), duration: z.array(count), operations: z.array(count),
});
const providers = z.object({
  summary: z.object({
    providersCount: z.number(), mostActiveProviderName: text, mostActiveProviderCommandCount: z.number(),
    fastestProviderName: text, fastestProviderAvgDurationMs: z.number(), mostReliableProviderName: text,
    mostReliableProviderSuccessRate: z.number(),
  }),
  commands: z.array(count), units: z.array(count), duration: z.array(count), operations: z.array(breakdown),
  outcomes: z.array(breakdown),
});
const activity = z.object({
  id: exact, operationDate: z.string(), userName: text, modelName: text, providerKeyName: text,
  operationType: z.union([z.string(), z.number()]).transform(String),
  durationMs: z.number(), unitType: z.union([z.string(), z.number()]).transform(String),
  inputUnitCount: exact, outputUnitCount: exact, isSuccess: z.boolean(), isCharged: z.boolean(),
});
const detail = activity.extend({
  conversationId: exact.nullish(), subscriptionId: z.number(), commandType: z.union([z.string(), z.number()]).transform(String), chargedAmount: z.number(),
  providerCost: z.number(), providerInputUnitPrice: z.number(), providerOutputUnitPrice: z.number(),
});
const userLookup = z.object({ users: z.array(simpleData), canReadAcrossTenants: z.boolean() });
const activityIntegers = ['id', 'inputUnitCount', 'outputUnitCount', 'conversationId'];
const namedOptions = (values: string[]) => values.map((name, id) => ({ id, name }));
const operations = namedOptions(['Chat', 'TextCompletion', 'Summarization', 'Translation', 'TextToSql', 'CodeGeneration',
  'EmbeddingGeneration', 'ImageUnderstanding', 'ImageGeneration', 'SpeechTranscription', 'TextToSpeech', 'AudioAnalysis',
  'Rerank', 'FunctionCallExecution', 'AgentExecution']);
const types = namedOptions(['Text', 'Instruction', 'SQL']);
export type Activity = z.infer<typeof activity>;
type Dates = { localStartDate: string; localEndDate: string };
export interface ActivityQuery extends Dates, Record<string, string | number> {
  customerId: number; providerId: number; modelId: number; userId: number;
  operationTypeId: number; commandTypeId: number; isSuccessFilter: number; isChargedFilter: number;
}
export type AiDashboard = { kind: 'framework'; value: z.infer<typeof frameworks> } | { kind: 'providers'; value: z.infer<typeof providers> };

export async function getAiDashboard(http: HttpClientManager, kind: AiDashboard['kind'], dates: Dates | undefined,
  customerId: number, signal: AbortSignal): Promise<AiDashboard> {
  const body = { customerId, ...(dates ?? { startDate: '0001-01-01T00:00:00Z', endDate: '9999-12-31T23:59:59Z' }) };
  const read = <T,>(name: string, schema: z.ZodType<T>, exactIntegerFields?: string[]) =>
    http.json(base + name, schema, { method: 'POST', body, signal, exactIntegerFields });
  if (kind === 'framework') {
    const [summary, commands, units, duration, operations] = await Promise.all([
      read('querycommandactivitykpisummary', frameworks.shape.summary, ['totalInputUnits', 'totalOutputUnits']),
      read('querycountcommandsbymodel', z.array(count)),
      read('querycountunitsbymodel', z.array(count)), read('queryavgdurationbymodel', z.array(count)),
      read('querycountcommandsbyoperationtype', z.array(count)),
    ]);
    return { kind, value: { summary, commands, units, duration, operations } };
  }
  const [summary, commands, units, duration, outcomes, operations] = await Promise.all([
    read('queryproviderdashboardkpisummary', providers.shape.summary), read('querycountcommandsbyprovider', z.array(count)),
    read('querycountunitsbyprovider', z.array(count)), read('queryavgdurationbyprovider', z.array(count)),
    read('querysuccessfailurebyprovider', z.array(breakdown)), read('querycommandsbyprovideroperationtype', z.array(breakdown)),
  ]);
  return { kind, value: { summary, commands, units, duration, outcomes, operations } };
}
export async function getAiLookups(http: HttpClientManager, customerId: number, signal: AbortSignal) {
  const [users, providers, models] = await Promise.all([
    http.json(withQuery(base + 'getcommandactivityusers', { customerId }), userLookup, { signal }),
    http.json(base + 'getproviderssimple', z.array(simpleData), { signal }),
    http.json(base + 'getmodelssimple', z.array(simpleData), { signal }),
  ]);
  const customers = users.canReadAcrossTenants
    ? await http.json('/api/customerservice/getcustomerssimple', z.array(simpleData), { signal }) : [];
  return { ...users, providers, models, customers, customerId, operations, types };
}
export async function getAiUsers(http: HttpClientManager, customerId: number, signal: AbortSignal) {
  return (await http.json(withQuery(base + 'getcommandactivityusers', { customerId }), userLookup, { signal })).users;
}
export function getAiActivities(http: HttpClientManager, query: ActivityQuery, signal: AbortSignal) {
  return http.json(base + 'getcommandactivities', z.array(activity), {
    method: 'POST', body: query, signal, exactIntegerFields: activityIntegers,
  });
}
export function getAiActivity(http: HttpClientManager, id: string, signal: AbortSignal) {
  return http.json(withQuery(base + 'getcommandactivity', { commandActivityId: id, metadataOnly: 'true' }), detail,
    { signal, exactIntegerFields: activityIntegers });
}
