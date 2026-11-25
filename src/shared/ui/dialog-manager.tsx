import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useGlobalization } from '../globalization';
import { Button } from './primitives';

interface DialogRequest { title?: string; message: string; accept?: string; reject?: string; acknowledge?: boolean }
type OpenDialog = (request: DialogRequest) => Promise<boolean>;
const DialogContext = createContext<OpenDialog | null>(null);

export function DialogManager({ children }: { children: ReactNode }) {
  const { t } = useGlobalization();
  const current = useRef<{ resolve: (answer: boolean) => void; trigger: HTMLElement | null } | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const open: OpenDialog = next => {
    if (current.current) return Promise.resolve(false);
    return new Promise(resolve => {
      const trigger = document.activeElement;
      current.current = { resolve, trigger: trigger instanceof HTMLElement ? trigger : null };
      setRequest(next);
    });
  };
  function close(answer: boolean) {
    const active = current.current;
    if (!active) return;
    focusTarget.current = active.trigger;
    current.current = null;
    setRequest(null);
    active.resolve(answer);
  }
  return <DialogContext.Provider value={open}>
    {children}
    <AlertDialog.Root open={Boolean(request)} onOpenChange={value => { if (!value) close(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/55" />
        <AlertDialog.Content onCloseAutoFocus={event => {
          if (focusTarget.current?.isConnected) {
            event.preventDefault();
            focusTarget.current.focus();
          }
        }} className="workspace-popup fixed top-1/2 left-1/2 z-[80] w-[min(90vw,29rem)] -translate-x-1/2 -translate-y-1/2">
          <AlertDialog.Title className="workspace-popup-title">{request?.title ?? t('Common.Confirm')}</AlertDialog.Title>
          <AlertDialog.Description className="workspace-popup-body text-sm">{request?.message}</AlertDialog.Description>
          <div className="workspace-popup-actions">
            {!request?.acknowledge && <AlertDialog.Cancel asChild><Button onClick={() => close(false)}>
              {request?.reject ?? t('No', undefined, 'Core')}
            </Button></AlertDialog.Cancel>}
            <AlertDialog.Action asChild><Button className="workspace-popup-confirm" onClick={() => close(true)}>
              {request?.accept ?? t(request?.acknowledge ? 'Ok' : 'Yes', undefined, 'Core')}
            </Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </DialogContext.Provider>;
}

export function useDialogManager() {
  const manager = useContext(DialogContext);
  if (!manager) throw new Error('DialogManager provider is required');
  return manager;
}
