import { createContext, useContext, useEffect, type ReactNode } from 'react';
import coreTr from '@/locales/core/tr-TR.json';
import coreEn from '@/locales/core/en-US.json';
import uiTr from '@/locales/ui/tr-TR.json';
import uiEn from '@/locales/ui/en-US.json';
import { ApiFailure } from './http';

export type ResourceOwner = 'UI' | 'Core';
export type Culture = 'tr-TR' | 'en-US';
type Catalog = Record<string, string>;
type Args = Record<string, string | number>;
const catalogs: Record<ResourceOwner, Record<Culture, Catalog>> = {
  UI: { 'tr-TR': uiTr, 'en-US': uiEn },
  Core: { 'tr-TR': coreTr, 'en-US': coreEn },
};

export function supportedCulture(value?: string): Culture {
  return value?.toLowerCase().startsWith('en') ? 'en-US' : 'tr-TR';
}

export function localize(culture: Culture, key: string, args?: Args, owner: ResourceOwner = 'UI') {
  const catalog = catalogs[owner];
  const value = catalog[culture][key] ?? catalog['tr-TR'][key] ?? '[' + owner + ':' + key + ']';
  return value.replace(/\{\{|\}\}|\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, field: string | undefined) => {
    if (token === '{{') return '{';
    if (token === '}}') return '}';
    return field && args?.[field] !== undefined ? String(args[field]) : token;
  });
}

export function createGlobalization(culture: Culture, timeZone: string) {
  let zone = timeZone;
  try { new Intl.DateTimeFormat(culture, { timeZone: zone }); } catch { zone = 'UTC'; }
  const t = (key: string, args?: Args, owner?: ResourceOwner) => localize(culture, key, args, owner);
  const date = (value?: string | null) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '–';
    const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return new Intl.DateTimeFormat(culture, {
      dateStyle: 'medium', ...(calendar ? {} : { timeStyle: 'short' }), timeZone: calendar ? 'UTC' : zone,
    }).format(new Date(value));
  };
  const error = (failure: unknown, mutation = false) => {
    if (failure instanceof ApiFailure) {
      if (failure.status === 403) return t('Common.Denied');
      if (failure.status === 404) return t('Common.Missing');
      if (failure.kind === 'timeout') return t('Common.Timeout');
      if (mutation && ['transport', 'invalid-response'].includes(failure.kind)) return t('Common.Unknown');
      if (failure.info.userFriendlyMessage) return failure.info.userFriendlyMessage;
      if (failure.kind === 'command' && failure.info.message) return failure.info.message;
    }
    return t('Common.Failed');
  };
  return { t, date, error, culture, timeZone: zone, number: new Intl.NumberFormat(culture) };
}

const GlobalizationContext = createContext(createGlobalization('tr-TR', 'UTC'));

export function GlobalizationProvider({ children, language, timeZone }: {
  children: ReactNode; language?: string; timeZone?: string;
}) {
  const culture = supportedCulture(language);
  useEffect(() => { document.documentElement.lang = culture; }, [culture]);
  return <GlobalizationContext.Provider value={createGlobalization(culture, timeZone ?? 'UTC')}>
    {children}
  </GlobalizationContext.Provider>;
}

export const useGlobalization = () => useContext(GlobalizationContext);
