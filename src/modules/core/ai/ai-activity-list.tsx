import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useWorkspace } from '@/app/workspace';
import type { SimpleDataView } from '@/shared/contracts';
import { exportTable } from '@/shared/export';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DataTable, ListPage, type Column } from '@/shared/ui/data-table';
import { DefinitionList, LoadingRegion, Page, PageGroup, StatusPanel } from '@/shared/ui/page';
import { Button, Field, Modal, SelectField, WorkspaceIcon } from '@/shared/ui/primitives';
import { Toolbar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { localDateInput } from '@/shared/zoned-dates';
import { getAiActivities, getAiActivity, getAiLookups, getAiUsers, type Activity, type ActivityQuery } from './ai-api';

const page = 'WebAICommandActivityList';
const view = 'WebViewCommandActivity';
const all = -1;

export function AiActivityList() {
  const { http, state } = useSession();
  const { canAction } = useWorkspace();
  const { t, date, timeZone, error, number } = useGlobalization();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ActivityQuery>(() => {
    const today = localDateInput(new Date().toISOString(), timeZone);
    return { localStartDate: today, localEndDate: today, customerId: all, providerId: all, modelId: all, userId: all,
      operationTypeId: all, commandTypeId: all, isSuccessFilter: 0, isChargedFilter: 0 };
  });
  const [applied, setApplied] = useState<ActivityQuery>();
  const [selected, select] = useState<string>();
  const [opened, setOpened] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const sessionCustomerId = state.stage === 'authenticated' ? state.session.customerId : 0;
  const loadChoices = useCallback((signal: AbortSignal) => getAiLookups(http, sessionCustomerId, signal), [http, sessionCustomerId]);
  const lookups = useResource(loadChoices);
  const choices = lookups.state === 'ready' ? lookups.data : undefined;
  const customerId = choices?.canReadAcrossTenants ? draft.customerId : choices?.customerId;
  const loadUsers = useCallback((signal: AbortSignal) => customerId !== undefined && customerId >= 0
    ? getAiUsers(http, customerId, signal) : Promise.resolve([]), [http, customerId]);
  const userResource = useResource(loadUsers);
  const users = userResource.state === 'ready' ? userResource.data : [];
  const loadRows = useCallback((signal: AbortSignal) => applied
    ? getAiActivities(http, applied, signal) : Promise.resolve([]), [http, applied]);
  const result = useResource(loadRows);
  const rows = result.state === 'ready' ? result.data : [];
  const core = (key: string) => t(key, undefined, 'Core');
  const title = t('AI.Activities');
  const options = (items: SimpleDataView[] = []) => [{ value: all, label: core('All') },
    ...items.map(item => ({ value: item.id, label: item.name || String(item.id) }))];
  const bools = [{ value: 0, label: core('All') }, { value: 1, label: core('Yes') }, { value: 2, label: core('No') }];
  const yes = (flag: boolean) => core(flag ? 'Yes' : 'No');
  const cells = [
    ['id', core('Id'), (item: Activity) => item.id],
    ['date', core('Date'), (item: Activity) => date(item.operationDate)],
    ['user', core('User'), (item: Activity) => item.userName || '–'],
    ['model', core('Model'), (item: Activity) => item.modelName || '–'],
    ['provider', core('Provider'), (item: Activity) => item.providerKeyName || '–'],
    ['operation', core('Operation'), (item: Activity) => item.operationType || '–'],
    ['duration', t('AI.Duration'), (item: Activity) => number.format(item.durationMs)],
    ['unit', core('Unit'), (item: Activity) => item.unitType || '–'],
    ['input', core('Input'), (item: Activity) => number.format(BigInt(item.inputUnitCount))],
    ['output', core('Output'), (item: Activity) => number.format(BigInt(item.outputUnitCount))],
    ['success', core('Success'), (item: Activity) => yes(item.isSuccess)],
    ['charged', core('Charged'), (item: Activity) => yes(item.isCharged)],
  ] as const;
  const columns: Column<Activity>[] = cells.map(([key, title, render]) => ({ key, title, render }));
  const setNumber = (key: keyof ActivityQuery) => (value: string) => setDraft(current => ({ ...current, [key]: Number(value) }));

  return <Page id="AICommandActivityList" title={title}>
    <ListPage resultsTitle={title}
      tools={<Toolbar operation="AICommandActivityList" actions={[
        { key: view, label: core('View'), icon: <WorkspaceIcon name="info" />, allowed: canAction(page, view),
          enabled: rows.some(item => item.id === selected), run: () => setOpened(selected) },
        { key: 'refresh', label: core('Refresh'), icon: <WorkspaceIcon name="arrow-sync" />, enabled: Boolean(applied), run: result.refresh },
        { key: 'export', label: core('Export'), icon: <WorkspaceIcon name="export" />, enabled: rows.length > 0,
          actions: (['xlsx', 'csv', 'pdf'] as const).map(format => ({ key: format, label: format.toUpperCase(), run: async () => {
            try {
              await exportTable(format, 'ai-command-activities', [columns.map(item => item.title),
                ...rows.map(item => cells.map(([, , render]) => render(item)))]);
            } catch (failure) { toast.error(error(failure)); }
          } })) },
        { key: 'close', label: core('Close'), icon: <WorkspaceIcon name="back" />, run: () => navigate('/index') },
      ]} />}
      query={<form className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
        event.preventDefault();
        if (!draft.localStartDate || !draft.localEndDate || draft.localStartDate > draft.localEndDate) {
          setInvalid(true);
          return;
        }
        if (customerId === undefined) return;
        setInvalid(false);
        select(undefined);
        setApplied({ ...draft, customerId });
      }}>
        <Field label={core('StartDate')} type="date" value={draft.localStartDate} onChange={localStartDate =>
          setDraft(current => ({ ...current, localStartDate }))} />
        <Field label={core('EndDate')} type="date" value={draft.localEndDate} onChange={localEndDate =>
          setDraft(current => ({ ...current, localEndDate }))} error={invalid ? t('JsonObject.InvalidRange') : undefined} />
        {choices?.canReadAcrossTenants && <SelectField label={core('Customer')} value={draft.customerId}
          options={options(choices.customers)} onChange={value =>
            setDraft(current => ({ ...current, customerId: Number(value), userId: all }))} />}
        <SelectField label={core('User')} value={draft.userId} options={options(users)} onChange={setNumber('userId')}
          disabled={customerId === all || userResource.state !== 'ready'} />
        <SelectField label={core('Provider')} value={draft.providerId} options={options(choices?.providers)} onChange={setNumber('providerId')} />
        <SelectField label={core('Model')} value={draft.modelId} options={options(choices?.models)} onChange={setNumber('modelId')} />
        <SelectField label={core('Operation')} value={draft.operationTypeId} options={options(choices?.operations)} onChange={setNumber('operationTypeId')} />
        <SelectField label={core('Type')} value={draft.commandTypeId} options={options(choices?.types)} onChange={setNumber('commandTypeId')} />
        <SelectField label={core('Success')} value={draft.isSuccessFilter} options={bools} onChange={setNumber('isSuccessFilter')} />
        <SelectField label={core('Charged')} value={draft.isChargedFilter} options={bools} onChange={setNumber('isChargedFilter')} />
        <div className="self-end"><Button type="submit" variant="primary" disabled={!choices || result.state === 'loading'}>{core('Search')}</Button></div>
        {lookups.state === 'error' && <div className="col-span-full"><StatusPanel kind="error" error={lookups.error} retry={lookups.refresh} /></div>}
        {userResource.state === 'error' && <div className="col-span-full"><StatusPanel kind="error" error={userResource.error} retry={userResource.refresh} /></div>}
      </form>}>
      <LoadingRegion loading={result.state === 'loading'}>
        {result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
          : <DataTable label={title} rows={rows} columns={columns} rowId={item => item.id} selected={selected}
            onSelect={item => select(item.id)} resizable />}
      </LoadingRegion>
    </ListPage>
    {opened && canAction(page, view) && <ActivityDetails id={opened} onClose={() => setOpened(undefined)} />}
  </Page>;
}

function ActivityDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { http } = useSession();
  const { t, date, number } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => getAiActivity(http, id, signal), [http, id]);
  const result = useResource(load);
  const core = (key: string) => t(key, undefined, 'Core');
  const item = result.state === 'ready' ? result.data : undefined;
  const unitPrice = new Intl.NumberFormat(number.resolvedOptions().locale, { maximumFractionDigits: 6 });
  return <Modal workspace title={t('AI.Activity') + ' ' + id} onClose={onClose}>
    {item ? <PageGroup title={core('Details')}>
      <DefinitionList items={[
        [core('Id'), item.id], [core('Date'), date(item.operationDate)], [core('User'), item.userName],
        [core('Provider'), item.providerKeyName], [core('Model'), item.modelName], [core('Operation'), item.operationType],
        [core('Type'), item.commandType], [t('AI.Duration'), number.format(item.durationMs)], [core('Unit'), item.unitType],
        [core('Input'), number.format(BigInt(item.inputUnitCount))], [core('Output'), number.format(BigInt(item.outputUnitCount))],
        [core('Success'), core(item.isSuccess ? 'Yes' : 'No')], [core('Charged'), core(item.isCharged ? 'Yes' : 'No')],
        [t('AI.Conversation'), item.conversationId], [t('AI.Subscription'), item.subscriptionId],
        [t('AI.ChargedAmount'), number.format(item.chargedAmount)], [t('AI.Cost'), number.format(item.providerCost)],
        [t('AI.InputUnitPrice'), unitPrice.format(item.providerInputUnitPrice)],
        [t('AI.OutputUnitPrice'), unitPrice.format(item.providerOutputUnitPrice)],
      ]} />
    </PageGroup> : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}
