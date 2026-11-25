import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { useDialogManager } from './ui/dialog-manager';
import { useGlobalization } from './globalization';
import { ApiFailure } from './http';

interface EditorGuard { dirty: boolean; pending: boolean }
interface GuardRegistry {
  register: (id: symbol, current: () => EditorGuard) => () => void;
  allowLeave: () => Promise<boolean>;
  leave: (navigate: () => void) => Promise<boolean>;
}
const GuardContext = createContext<GuardRegistry | null>(null);

export function formIsDirty<T>(baseline: T, values: T) {
  return JSON.stringify(baseline) !== JSON.stringify(values);
}

export function reconcileSavedValues<T extends object>(snapshot: T, latest: T, saved: T): T {
  const next = { ...latest };
  for (const key of Object.keys(saved) as Array<keyof T>) {
    if (!formIsDirty(snapshot[key], latest[key])) next[key] = saved[key];
  }
  return next;
}

export function FormStateService({ children }: { children: ReactNode }) {
  const guards = useRef(new Map<symbol, () => EditorGuard>());
  const approvedNavigation = useRef(false);
  const dialog = useDialogManager();
  const { t } = useGlobalization();
  const blocked = () => [...guards.current.values()].map(read => read())
    .some(editor => editor.dirty || editor.pending);
  async function allowLeave() {
    if ([...guards.current.values()].some(read => read().pending)) return false;
    if (!blocked()) return true;
    return dialog({ message: t('Common.Unsaved'), accept: t('Common.Discard'), reject: t('Common.Continue') });
  }
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.key !== nextLocation.key && !approvedNavigation.current && blocked());
  const resolving = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || resolving.current) return;
    resolving.current = true;
    void allowLeave().then(ok => {
      if (ok) blocker.proceed();
      else blocker.reset();
    }).finally(() => { resolving.current = false; });
  });
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!blocked()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, []);
  const register = useCallback((id: symbol, read: () => EditorGuard) => {
    guards.current.set(id, read);
    return () => { guards.current.delete(id); };
  }, []);
  async function leave(navigate: () => void) {
    if (!await allowLeave()) return false;
    approvedNavigation.current = true;
    try { navigate(); } finally { approvedNavigation.current = false; }
    return true;
  }
  return <GuardContext.Provider value={{ register, allowLeave, leave }}>{children}</GuardContext.Provider>;
}

export function useFormStateService() {
  const value = useContext(GuardContext);
  if (!value) throw new Error('FormStateService provider is required');
  return value;
}

export type FormErrors = Record<string, string>;

export function useEditForm<T extends object>(initial: T) {
  const { register } = useFormStateService();
  const dialog = useDialogManager();
  const { t } = useGlobalization();
  const [values, setValues] = useState(initial);
  const latest = useRef(values);
  latest.current = values;
  const [baseline, setBaseline] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const status = useRef({ dirty: false, pending: false });
  const id = useRef(Symbol('editor'));
  const dirty = formIsDirty(baseline, values);
  status.current = { dirty, pending: status.current.pending };
  useEffect(() => register(id.current, () => status.current), [register]);
  function change<K extends keyof T>(key: K, value: T[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(previous => ({ ...previous, [String(key)]: '' }));
  }
  async function requestClose(close: () => void) {
    if (status.current.pending) return;
    if (!status.current.dirty || await dialog({ message: t('Common.Unsaved'), accept: t('Common.Discard'), reject: t('Common.Continue') })) close();
  }
  async function submit(validate: (snapshot: T) => FormErrors, save: (snapshot: T) => Promise<void | T>,
    onError: (error: unknown) => void, onSaved?: (newerChanges: boolean) => void) {
    if (status.current.pending) return;
    const snapshot = values;
    const reason = validate(snapshot);
    setErrors(reason);
    if (Object.keys(reason).length) {
      focusInvalid();
      return;
    }
    status.current.pending = true;
    setPending(true);
    try {
      const saved = await save(snapshot) ?? snapshot;
      const newerChanges = formIsDirty(snapshot, latest.current);
      setBaseline(saved);
      setValues(current => reconcileSavedValues(snapshot, current, saved));
      status.current = { dirty: newerChanges, pending: false };
      onSaved?.(newerChanges);
    } catch (error) {
      if (error instanceof ApiFailure && error.info.errors) {
        setErrors(Object.fromEntries(Object.entries(error.info.errors).map(([key, value]) => {
          const field = key.replace(/^\$\./, '');
          return [field[0]?.toLowerCase() + field.slice(1), Array.isArray(value) ? value.join(' ') : value];
        })));
        focusInvalid();
      }
      onError(error);
    } finally {
      status.current.pending = false;
      setPending(false);
    }
  }
  const isModified = (key: keyof T) => formIsDirty(baseline[key], values[key]);
  return { values, setValues, change, dirty, pending, errors, isModified, requestClose, submit };
}

export function focusInvalid() {
  window.requestAnimationFrame(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const root = dialogs[dialogs.length - 1] ?? document;
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

export function validateContact(values: {
  userName?: string | null; nameSurname?: string | null; birthDate?: string | null;
  email?: string | null; email2?: string | null; phone?: string | null; phone2?: string | null;
  countryId?: number; cityId?: number; website?: string | null;
}, required: string, invalid: string): FormErrors {
  const errors: FormErrors = {};
  for (const key of ['userName', 'nameSurname', 'birthDate', 'email', 'phone', 'countryId', 'cityId'] as const) {
    const value = values[key];
    if (typeof value === 'string' ? !value.trim() : !value) errors[key] = required;
  }
  for (const key of ['email', 'email2'] as const) {
    const value = values[key];
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[key] = invalid;
  }
  for (const key of ['phone', 'phone2'] as const) {
    const value = values[key];
    if (value && (!/^\+?[\d ().-]+$/.test(value) || value.replace(/\D/g, '').length < 7)) errors[key] = invalid;
  }
  if (values.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate)) errors.birthDate = invalid;
  if (values.website) {
    try {
      if (!['http:', 'https:'].includes(new URL(values.website).protocol)) errors.website = invalid;
    } catch { errors.website = invalid; }
  }
  return errors;
}
