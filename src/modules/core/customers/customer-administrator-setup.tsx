import { useCallback, useRef, useState } from 'react';
import { useSession } from '@/app/session';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { StatusPanel } from '@/shared/ui/page';
import { Button, Modal } from '@/shared/ui/primitives';
import { ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { getAdministratorSetup, retryAdministratorSetup, type CustomerRow } from './customer-api';

export function CustomerAdministratorSetup({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const { http } = useSession();
  const { t, error } = useGlobalization();
  const core = (key: string) => t(key, undefined, 'Core');
  const load = useCallback((signal: AbortSignal) => getAdministratorSetup(http, customer.id, signal), [http, customer.id]);
  const result = useResource(load);
  const command = useRef(false);
  const [pending, setPending] = useState(false);
  const status = result.state === 'ready' ? result.data : undefined;
  const close = () => { if (!command.current) onClose(); };

  async function retry() {
    if (!status?.canRetry || command.current) return;
    command.current = true;
    setPending(true);
    try {
      await retryAdministratorSetup(http, customer.id);
      result.refresh();
    } catch (failure) {
      toast.error(error(failure, true));
    } finally {
      command.current = false;
      setPending(false);
    }
  }

  const title = (customer.customerName || String(customer.id)) + ' - ' + t('Customer.AdministratorSetup');
  return <Modal workspace title={title} onClose={close}>
    <ToolbarBar>
      <Button disabled={pending || result.state === 'loading'} onClick={result.refresh}>{core('Refresh')}</Button>
      {status?.canRetry && <Button disabled={pending} onClick={() => void retry()}>{t('Customer.RetrySetup')}</Button>}
      <Button disabled={pending} onClick={close}>{core('Close')}</Button>
    </ToolbarBar>
    {status ? <p role="status">{t(status.complete ? 'Customer.SetupComplete' : 'Customer.SetupIncomplete')}</p>
      : result.state === 'error' ? <StatusPanel kind="error" error={result.error} retry={result.refresh} />
        : <StatusPanel kind="loading" />}
  </Modal>;
}
