import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/app/session';
import { loadContact, loadLicence } from '@/app/workspace-api';
import { useGlobalization } from '@/shared/globalization';
import { useResource } from '@/shared/resource';
import { DefinitionList, Page, StatusPanel } from '@/shared/ui/page';
import { Panel } from '@/shared/ui/primitives';
import { ClosePageButton, ToolbarBar } from '@/shared/ui/toolbar';

export function HomePage() {
  const { state, http } = useSession();
  const { t, date } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => loadLicence(http, signal), [http]);
  const licence = useResource(load);
  if (state.stage !== 'authenticated') return null;
  const { session } = state;
  const details = licence.state === 'ready' ? licence.data : undefined;
  return <Page id="Home" title={t('Page.Home')} overview>
    <div className="workspace-overview">
      <Panel className="workspace-overview-panel">
        <dl>
          <dt>{t('Field.Customer')}</dt><dd><Link to="/contact" aria-label={t('Page.Contact')}>{session.customerName?.trim() || '–'}</Link></dd>
          <dt>{t('Page.Licence')}</dt><dd><Link to="/licence" aria-label={t('Page.Licence')}>
            {licence.state === 'loading' ? <span role="status">{t('Common.Loading')}</span> : details?.licenceName ?? '–'}
          </Link></dd>
          <dt>{t('Field.StartDate')}</dt><dd>{date(details?.startDate)}</dd>
          <dt>{t('Field.EndDate')}</dt><dd>{date(details?.endDate)}</dd>
        </dl>
        {licence.state === 'error' && <StatusPanel kind="error" error={licence.error} retry={licence.refresh} />}
      </Panel>
      <Panel className="workspace-overview-panel">
        <dl>
          <dt>{t('UserName', undefined, 'Core')}</dt><dd><Link to="/myprofile" aria-label={t('Page.Profile')}>{session.userName}</Link></dd>
          <dt>{t('Field.Name')}</dt><dd>{session.nameSurname?.trim() || '–'}</dd>
          <dt>{t('Field.TimeZone')}</dt><dd>{session.timeZone}</dd>
          <dt>{t('Field.Language')}</dt><dd><Link to="/mypreferences" aria-label={t('Page.Preferences')}>{session.language}</Link></dd>
        </dl>
      </Panel>
    </div>
  </Page>;
}

export function ContactPage() {
  const { http } = useSession();
  const { t } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => loadContact(http, signal), [http]);
  const result = useResource(load);
  return <Page id="Contact" title={t('Page.Contact')}>
    <ToolbarBar><ClosePageButton /></ToolbarBar>
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
    {result.state === 'ready' && (result.data ? <DefinitionList compact className="workspace-compact-fields" items={[
      [t('Field.Name'), result.data.name ?? result.data.companyName],
      [t('InfoEmail', undefined, 'Core'), result.data.infoMail ?? result.data.email],
      [t('SupportEmail', undefined, 'Core'), result.data.supportMail],
      [t('Field.Phone'), result.data.phone], [t('Field.Website'), result.data.website],
    ]} /> : <StatusPanel kind="empty" />)}
  </Page>;
}

export function LicencePage() {
  const { http } = useSession();
  const { t, date, number } = useGlobalization();
  const load = useCallback((signal: AbortSignal) => loadLicence(http, signal), [http]);
  const result = useResource(load);
  return <Page id="Licence" title={t('Page.Licence')}>
    <ToolbarBar><ClosePageButton /></ToolbarBar>
    {result.state === 'loading' && <StatusPanel kind="loading" />}
    {result.state === 'error' && <StatusPanel kind="error" error={result.error} retry={result.refresh} />}
    {result.state === 'ready' && (result.data ? <DefinitionList compact className="workspace-compact-fields" items={[
      [t('Page.Licence'), result.data.licenceName], [t('Field.LicenceType'), result.data.licenceTypeName],
      [t('Field.StartDate'), date(result.data.startDate)], [t('Field.EndDate'), date(result.data.endDate)],
      [t('Field.Trial'), t(result.data.isTrial ? 'Yes' : 'No', undefined, 'Core')],
      [t('Field.UserLimit'), number.format(result.data.maxUserCount)],
    ]} /> : <StatusPanel kind="empty" />)}
  </Page>;
}

export function AboutPage() {
  const { t } = useGlobalization();
  return <Page id="About" title={t('Page.About')}>
    <ToolbarBar><ClosePageButton /></ToolbarBar>
    <DefinitionList compact className="workspace-compact-fields"
      items={[[t('Application', undefined, 'Core'), 'DCPCoreXWeb'], [t('Field.Version'), import.meta.env.VITE_APP_VERSION ?? '0.1.0']]} />
  </Page>;
}

export function ErrorPage({ kind }: { kind: 'error' | 'missing' | 'denied' }) {
  const { t } = useGlobalization();
  return <div className="mx-auto grid max-w-xl gap-4 p-6">
    <StatusPanel kind={kind} />
    <Link to="/index" className="text-primary underline">{t('Common.Home')}</Link>
  </div>;
}
