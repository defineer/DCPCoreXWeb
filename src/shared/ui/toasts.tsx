import { Toaster, toast } from 'sonner';
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useGlobalization } from '../globalization';

export function ToastHost() {
  const { t } = useGlobalization();
  return <Toaster position="bottom-right" theme="light" richColors expand visibleToasts={5} closeButton duration={5000}
    className="workspace-toasts" style={{ '--width': '320px' } as CSSProperties}
    icons={{ success: <CheckCircle2 />, info: <Info />, warning: <TriangleAlert />, error: <CircleAlert /> }}
    toastOptions={{ closeButtonAriaLabel: t('Close', undefined, 'Core') }} />;
}

export { toast };
