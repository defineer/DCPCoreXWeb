import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from './utils';
import { useGlobalization } from '../globalization';

const buttonVariants = cva(
  'inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  { variants: { variant: {
    primary: 'border-transparent bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-hover-foreground',
    outline: 'border-border bg-card text-foreground hover:bg-muted',
    ghost: 'border-transparent hover:bg-muted',
    destructive: 'border-border bg-card text-destructive hover:bg-muted',
  } }, defaultVariants: { variant: 'outline' } },
);

export function Button({ className, variant, type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export function WorkspaceIcon({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={cn('workspace-icon', className)}
    style={{ maskImage: `url(/images/${name}.svg)` }} />;
}

export const controlClass = 'workspace-control min-h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground';

export function Field({ label, value, onChange, error, valid, ...props }: {
  label: string; value: string | number; onChange: (value: string) => void; error?: string; valid?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  return <label className="workspace-field grid gap-1.5 text-sm font-medium" htmlFor={id}>
    <span>{label}</span>
    <input {...props} id={id} value={value} onChange={e => onChange(e.target.value)}
      aria-invalid={Boolean(error)} data-valid={valid && !error || undefined} aria-describedby={error ? id + '-error' : undefined}
      className={cn(controlClass, props.className)} />
    {error && <span id={id + '-error'} className="text-destructive">{error}</span>}
  </label>;
}

export function SelectField({ label, value, options, onChange, error, disabled, valid }: {
  label: string; value: string | number; options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void; error?: string; disabled?: boolean; valid?: boolean;
}) {
  const id = useId();
  return <label className="workspace-field grid gap-1.5 text-sm font-medium" htmlFor={id}>
    <span>{label}</span>
    <select id={id} value={value} disabled={disabled} aria-invalid={Boolean(error)} data-valid={valid && !error || undefined}
      aria-describedby={error ? id + '-error' : undefined} className={controlClass} onChange={e => onChange(e.target.value)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {error && <span id={id + '-error'} className="text-destructive">{error}</span>}
  </label>;
}

export function CheckField({ label, value, onChange, disabled }: {
  label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
    <input type="checkbox" className="size-4 accent-primary" checked={value} disabled={disabled}
      onChange={e => onChange(e.target.checked)} />{label}
  </label>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-border bg-card shadow-sm', className)}>{children}</section>;
}

export function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="workspace-form-group m-0 min-w-0 rounded-lg border border-border px-4 pb-4">
    <legend className="px-2 text-sm font-semibold">{title}</legend>
    <div className="workspace-form-group-body grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">{children}</div>
  </fieldset>;
}

export function Modal({ title, description, children, onClose, workspace }: {
  title: string; description?: string; children: ReactNode; onClose: () => void; workspace?: boolean;
}) {
  const { t } = useGlobalization();
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55" />
      <Dialog.Content className={cn('workspace-popup fixed top-1/2 left-1/2 z-50 w-[min(92vw,48rem)] -translate-x-1/2 -translate-y-1/2',
        workspace && 'w-[min(94vw,70rem)]')}>
        <div className={workspace ? 'workspace-title relative' : 'workspace-popup-title relative'}>
          <div><Dialog.Title className="line-clamp-2" title={title}>{title}</Dialog.Title>
            <Dialog.Description className={description ? 'text-sm font-normal' : 'sr-only'}>{description ?? title}</Dialog.Description></div>
          <Button variant="ghost" aria-label={t('Close', undefined, 'Core')} onClick={onClose}
            className="absolute top-0.5 right-1 min-h-7 px-1.5 hover:bg-primary-hover hover:text-primary-hover-foreground"><X /></Button>
        </div>
        <div className={workspace ? 'workspace-page-body' : 'workspace-popup-body'}>{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
