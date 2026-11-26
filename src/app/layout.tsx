import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Shield } from 'lucide-react';
import { GlobalizationProvider, useGlobalization } from '@/shared/globalization';
import { FormStateService, useFormStateService } from '@/shared/forms';
import { DialogManager } from '@/shared/ui/dialog-manager';
import { ToastHost, toast } from '@/shared/ui/toasts';
import { ApplicationErrorBoundary, StatusPanel } from '@/shared/ui/page';
import { Button, WorkspaceIcon } from '@/shared/ui/primitives';
import { cn } from '@/shared/ui/utils';
import { safeReturnPath, sessionDeadline, useSession } from './session';
import { useWorkspace, WorkspaceProvider, type NavigationEntry } from './workspace';

export function RootLayout() {
  const { state } = useSession();
  const session = state.stage === 'authenticated' ? state.session : undefined;
  return <GlobalizationProvider language={session?.language} timeZone={session?.timeZone}>
    <ApplicationErrorBoundary>
      <DialogManager><FormStateService><Outlet /><ToastHost /></FormStateService></DialogManager>
    </ApplicationErrorBoundary>
  </GlobalizationProvider>;
}

export function RedirectToLogin() {
  const location = useLocation();
  return <Navigate replace to="/login" state={{ returnTo: safeReturnPath(location.pathname + location.search) }} />;
}

export function ProtectedLayout() {
  const { state, restore } = useSession();
  const location = useLocation();
  if (state.stage === 'loading') return <div className="mx-auto max-w-lg p-6"><StatusPanel kind="loading" /></div>;
  if (state.stage === 'error') return <div className="mx-auto max-w-lg p-6">
    <StatusPanel kind="error" error={state.error} retry={() => void restore()} />
  </div>;
  if (state.stage !== 'authenticated') return <RedirectToLogin />;
  if (state.session.isLimitedSession) {
    if (location.pathname !== '/changepassword') return <Navigate replace to="/changepassword"
      state={{ returnTo: safeReturnPath(location.state?.returnTo ?? location.pathname + location.search) }} />;
    return <AuthLayout><Outlet /></AuthLayout>;
  }
  return <WorkspaceProvider key={state.session.customerId + ':' + state.session.userId}>
    <MainLayout />
  </WorkspaceProvider>;
}

export function FeatureGate({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const workspace = useWorkspace();
  const location = useLocation();
  if (workspace.state === 'loading') return <StatusPanel kind="loading" />;
  if (workspace.state === 'error') return <StatusPanel kind="error" error={workspace.error} retry={workspace.refresh} />;
  if (!workspace.canPage(pageKey)) return location.state?.afterLogin === true
    ? <Navigate replace to="/index" /> : <StatusPanel kind="denied" />;
  return <>{children}</>;
}

export function AuthLayout({ children }: { children?: ReactNode }) {
  return <main className="workspace-auth grid min-h-svh place-items-center bg-background p-4 sm:p-8">
    <div className="w-full max-w-[30rem]">
      {children ?? <Outlet />}
    </div>
  </main>;
}

const accountLinks = [
  ['/myprofile', 'Page.Profile'], ['/mypreferences', 'Page.Preferences'], ['/mysessions', 'Page.Sessions'],
  ['/changepassword', 'Page.ChangePassword'], ['/contact', 'Page.Contact'], ['/licence', 'Page.Licence'], ['/about', 'Page.About'],
] as const;

const popup = 'workspace-nav-popup absolute z-30 mt-1 grid min-w-48 gap-1 rounded-lg border border-border bg-card p-1.5 text-foreground shadow-lg';
const popupItem = 'block rounded-md px-3 py-2 text-left text-sm hover:bg-primary-hover hover:text-primary-hover-foreground focus-visible:outline-offset-0';
const headerItemHover = 'hover:bg-primary-hover hover:text-primary-hover-foreground';
const summary = 'flex list-none select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium cursor-pointer [&::-webkit-details-marker]:hidden';

function closeMenus(event: React.MouseEvent<HTMLElement>) {
  let menu = event.currentTarget.closest('details');
  while (menu) {
    menu.open = false;
    menu = menu.parentElement?.closest('details') ?? null;
  }
}

export function TopMenu() {
  const { state, logout } = useSession();
  const { preferences } = useWorkspace();
  const { allowLeave } = useFormStateService();
  const { t } = useGlobalization();
  const navigate = useNavigate();
  if (state.stage !== 'authenticated') return null;
  const name = preferences?.displayName || state.session.displayName || state.session.userName;
  async function signOut() {
    if (!await allowLeave()) return;
    const confirmed = await logout();
    if (!confirmed) toast.warning(t('Auth.Revocation'));
    await navigate('/login', { replace: true });
  }
  return <details className="relative min-w-0">
    <summary aria-label={name} className={cn(summary, headerItemHover)}>
      <WorkspaceIcon name="account/user" />
      <span className="hidden max-w-36 truncate sm:block">{name}</span><ChevronDown className="size-3.5" />
    </summary>
    <div className={cn(popup, 'right-0')}>
      {accountLinks.map(([path, key]) => <Link key={path} to={path} className={popupItem} onClick={closeMenus}>{t(key)}</Link>)}
      <button type="button" className={popupItem} onClick={event => {
        closeMenus(event);
        void signOut();
      }}>{t('Page.Logout')}</button>
    </div>
  </details>;
}

export function AppMenu() {
  const workspace = useWorkspace();
  const { leave } = useFormStateService();
  const { t } = useGlobalization();
  const navigate = useNavigate();
  async function select(id: number) {
    if (id === workspace.applicationId) return;
    await leave(() => {
      workspace.selectApplication(id);
      void navigate('/index');
    });
  }
  return <details className="relative">
    <summary className={cn(summary, headerItemHover)} aria-label={t('App.Choose')}>
      <WorkspaceIcon name="products" /><span className="hidden md:block">{t('App.Choose')}</span>
      <ChevronDown className="size-3.5" />
    </summary>
    <div className={cn(popup, 'right-0')}>
      {workspace.state === 'error' && <button type="button" className={popupItem} onClick={workspace.refresh}>
        {t('Common.Retry')}
      </button>}
      {!workspace.applications.length && <span className={popupItem}>{t('App.NoApplications')}</span>}
      {workspace.applications.map(app => <button type="button" key={app.id} className={popupItem}
        aria-current={app.id === workspace.applicationId ? 'true' : undefined}
        onClick={event => { closeMenus(event); void select(app.id); }}>
        {app.keyName === 'CoreApplication' ? t('App.Core') : app.name}
      </button>)}
    </div>
  </details>;
}

function containsPage(entry: NavigationEntry, path: string): boolean {
  return entry.page?.path === path || entry.children.some(child => containsPage(child, path));
}

function NavEntries({ entries, layout, nested = false }: {
  entries: NavigationEntry[]; layout: 'left' | 'collapsed' | 'top'; nested?: boolean;
}) {
  const { t } = useGlobalization();
  const { pathname } = useLocation();
  const popupNav = layout === 'top' || (layout === 'collapsed' && !nested);
  const list = useRef<HTMLUListElement>(null);
  const activeBranch = layout === 'left'
    ? entries.find(entry => entry.children.some(child => containsPage(child, pathname)))?.id
    : undefined;
  useEffect(() => {
    const branch = list.current?.querySelector<HTMLDetailsElement>(':scope > li > details[data-current-branch]');
    if (branch) branch.open = true;
  }, [activeBranch]);

  return <ul ref={list} className={cn('m-0 list-none p-0', layout === 'top' && !nested && 'flex min-w-0 flex-wrap items-center gap-1',
    layout === 'left' && nested && 'pb-1')}>
    {entries.map(entry => {
      const label = entry.page ? t(entry.page.label) : entry.key === 'SecurityWebUI' ? t('App.SecurityManagement') : entry.label;
      const icon = entry.page ? <WorkspaceIcon name="gridlist" className="size-5" /> : <Shield className="size-4 shrink-0" />;
      const iconOnly = layout === 'collapsed' && !nested;
      const linkClass = layout === 'left' || iconOnly
        ? 'flex min-h-[2.4rem] items-center gap-3 px-3 text-sm text-sidebar-foreground aria-[current=page]:bg-sidebar-active aria-[current=page]:text-sidebar-active-text'
        : popupItem;
      const mobileTop = layout === 'top' && !nested;
      return <li key={entry.id} className={mobileTop ? 'sm:relative' : 'relative'}>
        {entry.page && <NavLink to={entry.page.path} className={cn(linkClass, iconOnly && 'justify-center')}
          aria-label={label} title={iconOnly ? label : undefined} onClick={layout === 'left' ? undefined : closeMenus}>
          <span className="flex min-w-0 items-center gap-2">{icon}{!iconOnly && <span className="truncate">{label}</span>}</span>
        </NavLink>}
        {entry.children.length > 0 && <details className={cn('group/nav', mobileTop ? 'sm:relative' : 'relative')}
          data-current-branch={entry.id === activeBranch || undefined}>
          <summary aria-label={label} title={iconOnly ? label : undefined}
            className={cn(summary, layout === 'left' || iconOnly ? 'text-sidebar-foreground'
              : nested ? 'hover:bg-primary-hover hover:text-primary-hover-foreground' : headerItemHover,
              layout === 'left' && 'min-h-[3.125rem] gap-3 rounded-none px-4', iconOnly && 'justify-center px-2')}>
            {layout === 'left' ? <ChevronRight aria-hidden className="size-5 shrink-0 group-open/nav:rotate-90" /> : icon}
            {!iconOnly && <><span className="flex-1 truncate">{label}</span>{layout !== 'left' && <ChevronDown className="size-3.5" />}</>}
          </summary>
          <div className={cn(popupNav && !nested ? popup : 'pl-2', iconOnly && 'left-full top-0 ml-1 mt-0',
            mobileTop && 'max-sm:inset-x-0')}>
            <NavEntries entries={entry.children} layout={popupNav ? 'top' : layout} nested />
          </div>
        </details>}
      </li>;
    })}
  </ul>;
}

export function LeftMenu({ collapsed }: { collapsed: boolean }) {
  const { menu } = useWorkspace();
  const { t } = useGlobalization();
  return <aside id="left-navigation" data-print-hidden className={cn(
    'workspace-sidebar sticky top-0 z-30 flex h-svh shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground',
    collapsed ? 'w-12' : 'w-40 sm:w-[14.75rem]',
  )}>
    <Link to="/index" className={cn('flex min-h-[3.75rem] items-start pt-3.5 text-sm font-bold text-primary',
      collapsed ? 'justify-center' : 'pl-6 sm:pl-[3.75rem]')} aria-label="DCPCoreX">
      DCP
    </Link>
    <nav aria-label={t('App.Workspace')} className={cn('min-h-0', !collapsed && 'overflow-y-auto')}>
      <NavEntries key={String(collapsed)} entries={menu} layout={collapsed ? 'collapsed' : 'left'} />
    </nav>
    {!collapsed && <footer className="mx-2 mt-auto mb-5 border-t border-border px-3 py-3 text-xs text-muted-foreground">
      {t('App.Copyright', { year: new Date().getFullYear() })}
    </footer>}
  </aside>;
}

export function TopMenuNavigation() {
  const { menu } = useWorkspace();
  const { t } = useGlobalization();
  return <nav aria-label={t('App.Workspace')} className="relative flex min-w-0 flex-wrap items-center gap-1 max-sm:order-last max-sm:w-full">
    <NavLink to="/index" className={cn('rounded-md px-3 py-2 text-sm aria-[current=page]:bg-white/20', headerItemHover)}>{t('Page.Home')}</NavLink>
    <NavEntries entries={menu} layout="top" />
  </nav>;
}

export function MainLayout() {
  const { preferences } = useWorkspace();
  const { state } = useSession();
  const { t } = useGlobalization();
  const location = useLocation();
  const [override, setOverride] = useState<boolean>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = override ?? preferences?.menuCollapsed ?? false;
  const top = preferences?.menuPosition === 0 || (preferences?.menuPosition == null && import.meta.env.VITE_DEFAULT_MENU_POSITION === 'top');
  useEffect(() => { setOverride(undefined); }, [preferences?.menuCollapsed]);
  useEffect(() => { setMobileOpen(false); }, [location.key]);
  useEffect(() => {
    if (state.stage !== 'authenticated' || !preferences?.notifyBeforeSessionClosedAsSec) return;
    const deadline = sessionDeadline(state.session);
    const warningMs = preferences.notifyBeforeSessionClosedAsSec * 1000;
    if (warningMs <= 0 || deadline <= Date.now()) return;
    const timer = window.setTimeout(() => toast.warning(t('Auth.Remaining'), { id: 'session-expiry' }),
      Math.min(Math.max(0, deadline - Date.now() - warningMs), 2_147_483_647));
    return () => { window.clearTimeout(timer); toast.dismiss('session-expiry'); };
  }, [state, preferences?.notifyBeforeSessionClosedAsSec, t]);

  return <div className="flex min-h-svh" data-mobile-navigation={mobileOpen ? 'open' : undefined}>
    <a className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-card focus:p-3" href="#main-content">{t('App.Skip')}</a>
    {!top && <LeftMenu collapsed={collapsed && !mobileOpen} />}
    <div className="min-w-0 flex-1">
      <header data-print-hidden className="sticky top-0 z-40 flex min-h-[2.625rem] flex-wrap items-center gap-1 bg-app-header px-2 text-app-header-foreground sm:gap-4 sm:px-6">
        {top ? <>
          <Link to="/index" className="font-semibold">DCPCoreX</Link>
          <TopMenuNavigation />
        </> : <><Button variant="ghost" className={cn(headerItemHover, 'hidden sm:inline-flex')} onClick={() => setOverride(!collapsed)}
          aria-controls="left-navigation" aria-expanded={!collapsed}
          aria-label={t(collapsed ? 'App.OpenNavigation' : 'App.CloseNavigation')}>
          <Menu />
        </Button><Button variant="ghost" className={cn(headerItemHover, 'sm:hidden')} onClick={() => setMobileOpen(!mobileOpen)}
          aria-controls="left-navigation" aria-expanded={mobileOpen} aria-label={t(mobileOpen ? 'App.CloseNavigation' : 'App.OpenNavigation')}>
          <Menu />
        </Button><NavLink to="/index" className={cn('flex items-center gap-1 rounded-sm px-2 py-2 text-sm', headerItemHover)}>
          <ChevronLeft aria-hidden className="size-5" />{t('Page.Home')}
        </NavLink></>}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2"><AppMenu /><TopMenu /></div>
      </header>
      <main id="main-content" tabIndex={-1} className="p-2">
        <ApplicationErrorBoundary key={location.key} identity="page"><Outlet /></ApplicationErrorBoundary>
      </main>
    </div>
  </div>;
}
