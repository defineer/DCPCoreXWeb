import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout, FeatureGate, ProtectedLayout, RootLayout } from './layout';
import { ChangePasswordPage, LoginPage, ResetPasswordPage } from '@/common-pages/auth-pages';
import { AboutPage, ContactPage, ErrorPage, HomePage, LicencePage } from '@/common-pages/info-pages';
import { ProfilePage } from '@/common-pages/profile-page';
import { PreferencesPage } from '@/common-pages/preferences-page';
import { SessionsPage } from '@/common-pages/sessions-page';
import { coreRoutes } from '@/modules/core/routes';

export const router = createBrowserRouter([{ element: <RootLayout />, errorElement: <ErrorPage kind="error" />,
  hydrateFallbackElement: <div role="status" className="p-6">DCPCoreX</div>, children: [
  { index: true, element: <Navigate replace to="/index" /> },
  { element: <AuthLayout />, children: [
    { path: '/login', element: <LoginPage /> }, { path: '/resetpassword', element: <ResetPasswordPage /> },
  ] },
  { element: <ProtectedLayout />, children: [
    { path: '/index', element: <HomePage /> },
    { path: '/myprofile', element: <ProfilePage /> },
    { path: '/mypreferences', element: <PreferencesPage /> },
    { path: '/mysessions', element: <SessionsPage /> },
    { path: '/changepassword', element: <ChangePasswordPage /> },
    { path: '/contact', element: <ContactPage /> },
    { path: '/licence', element: <LicencePage /> },
    { path: '/about', element: <AboutPage /> },
    ...coreRoutes.map(({ pageKey, path, load }) => ({ path, lazy: async () => {
      const CorePage = await load();
      return { Component: () => <FeatureGate pageKey={pageKey}><CorePage /></FeatureGate> };
    } })),
  ] },
  { path: '/error', element: <ErrorPage kind="error" /> },
  { path: '/access-denied', element: <ErrorPage kind="denied" /> },
  { path: '*', element: <ErrorPage kind="missing" /> },
] }]);
