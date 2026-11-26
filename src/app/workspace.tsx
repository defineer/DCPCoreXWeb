import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from './session';
import { loadWorkspace, type ApplicationElementView, type WebUserPreferenceView } from './workspace-api';
import { useResource } from '@/shared/resource';
import { coreRoutes } from '@/modules/core/routes';

export const featureRoutes = coreRoutes.flatMap(({ path, label, pageKey }) => label ? [{ path, label, pageKey }] : []);
export type FeatureRoute = typeof featureRoutes[number];
export interface NavigationEntry { id: number; label: string; key?: string | null; page?: FeatureRoute; children: NavigationEntry[] }

function menuVisible(node: ApplicationElementView): boolean {
  if (!node.elementContent) return false;
  try {
    const content: unknown = JSON.parse(node.elementContent);
    return typeof content === 'object' && content !== null && 'isMenuVisible' in content && content.isMenuVisible === true;
  } catch { return false; }
}

export function applicationGraph(elements: ApplicationElementView[], applicationId: number) {
  const graph = new Map<number, ApplicationElementView>();
  const byParent = new Map<number, ApplicationElementView[]>();
  for (const element of elements) {
    const bucket = byParent.get(element.parentElementId) ?? [];
    bucket.push(element);
    byParent.set(element.parentElementId, bucket);
  }
  const visited = new Set([applicationId]);
  const build = (parent: number): NavigationEntry[] => {
    const entries: NavigationEntry[] = [];
    for (const child of [...(byParent.get(parent) ?? [])].sort((a, b) => a.listOrder - b.listOrder)) {
      if (visited.has(child.elementId) || child.isApplication) continue;
      visited.add(child.elementId);
      graph.set(child.elementId, child);
      const children = build(child.elementId);
      const page = child.elementTypeKeyName === 'WebForm' && child.accessRight > 0 && menuVisible(child)
        ? featureRoutes.find(route => route.pageKey === child.keyName) : undefined;
      if (page || children.length) entries.push({
        id: child.elementId, label: child.elementName ?? child.keyName ?? '', key: child.keyName, page, children,
      });
    }
    return entries;
  };
  const menu = build(applicationId);
  return { menu, graph };
}

interface WorkspaceValue {
  state: 'loading' | 'ready' | 'error';
  error?: unknown;
  applications: Array<{ id: number; name?: string | null; keyName?: string | null }>;
  applicationId?: number;
  selectApplication: (id: number) => void;
  preferences?: WebUserPreferenceView;
  setPreferences: (preferences: WebUserPreferenceView) => void;
  menu: NavigationEntry[];
  canPage: (key: string) => boolean;
  hasSharedPageGrant: (key: string) => boolean;
  canAction: (page: string, action: string) => boolean;
  pageOptions: (id: number) => Array<{ id: number; label: string }>;
  refresh: () => void;
}
const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { http, state } = useSession();
  const session = state.stage === 'authenticated' ? state.session : undefined;
  const userId = session?.userId;
  const customerId = session?.customerId;
  const load = useCallback((signal: AbortSignal) => {
    if (userId === undefined || customerId === undefined) throw new Error('Missing workspace identity');
    return loadWorkspace(http, userId, customerId, signal);
  }, [http, userId, customerId]);
  const data = useResource(load);
  const [selected, selectApplication] = useState<number>();
  const [override, setPreferences] = useState<WebUserPreferenceView>();
  const ready = data.state === 'ready' ? data.data : undefined;
  const applications = ready?.applications ?? [];
  const preferences = override ?? ready?.preferences;
  const applicationId = applications.find(app => app.id === selected)?.id
    ?? applications.find(app => app.id === preferences?.defaultApplicationId)?.id
    ?? applications[0]?.id;
  const { graph, menu } = applicationGraph(ready?.elements ?? [], applicationId ?? -1);

  useEffect(() => {
    const theme = preferences?.theme?.toLowerCase();
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' ||
      (theme !== 'light' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      document.documentElement.classList.remove('dark');
    };
  }, [preferences?.theme]);

  const findPage = (key: string) => [...graph.values()].find(element =>
    element.keyName === key && element.elementTypeKeyName === 'WebForm' && element.accessRight > 0);
  const hasSharedPageGrant = (key: string) => Boolean(ready?.elements.some(element =>
    element.keyName === key && element.elementTypeKeyName === 'WebForm' && element.accessRight > 0));
  const canAction = (page: string, action: string) => {
    const parent = findPage(page);
    return Boolean(parent && [...graph.values()].some(node => node.parentElementId === parent.elementId &&
      node.keyName === action && node.elementTypeKeyName === 'WebFormAction' && node.accessRight === 1));
  };
  const pageOptions = (id: number) => [...applicationGraph(ready?.elements ?? [], id).graph.values()]
    .filter(node => node.elementTypeKeyName === 'WebForm' && node.accessRight > 0 && menuVisible(node) &&
      featureRoutes.some(route => route.pageKey === node.keyName))
    .map(node => ({ id: node.elementId, label: node.elementName ?? node.keyName ?? '' }));

  return <WorkspaceContext.Provider value={{
    state: data.state, error: data.state === 'error' ? data.error : undefined, applications, applicationId,
    preferences, setPreferences, menu, canPage: key => Boolean(findPage(key)), hasSharedPageGrant, canAction, pageOptions,
    selectApplication, refresh: data.refresh,
  }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
