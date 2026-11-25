import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useSession, isOtpChallenge, LoginChallengeFailure, safeReturnPath } from '@/app/session';
import { changePassword } from '@/app/workspace-api';
import { useGlobalization } from '@/shared/globalization';
import { Button, Field, Modal, Panel } from '@/shared/ui/primitives';
import { useDialogManager } from '@/shared/ui/dialog-manager';
import { Page, StatusPanel } from '@/shared/ui/page';
import { ClosePageButton, ToolbarBar } from '@/shared/ui/toolbar';
import { toast } from '@/shared/ui/toasts';
import { focusInvalid, useEditForm } from '@/shared/forms';

export function LoginPage() {
  const { state, restore, login } = useSession();
  const dialog = useDialogManager();
  const { t } = useGlobalization();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState(() => {
    const useLocalDefaults = import.meta.env.DEV && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname);
    return {
      userName: useLocalDefaults ? import.meta.env.VITE_LOCAL_LOGIN_USERNAME ?? '' : '',
      password: useLocalDefaults ? import.meta.env.VITE_LOCAL_LOGIN_PASSWORD ?? '' : '',
      otpCode: '',
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [otp, setOtp] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const activated = useRef(false);
  const returnTo = safeReturnPath(location.state?.returnTo);

  async function submit(useCode: boolean) {
    if (busy.current) return;
    const invalid: Record<string, string> = {};
    if (!values.userName.trim()) invalid.userName = t('Common.Required');
    if (!values.password) invalid.password = t('Common.Required');
    if (useCode && !/^\d{6}$/.test(values.otpCode)) invalid.otpCode = t('Common.Invalid');
    setErrors(invalid);
    if (Object.keys(invalid).length) { focusInvalid(); return; }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      activated.current = true;
      const session = await login({ userName: values.userName.trim(), password: values.password,
        ...(useCode ? { otpCode: values.otpCode } : {}) });
      setValues({ userName: '', password: '', otpCode: '' });
      setOtp(false);
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!session.isLimitedSession && browserTimeZone && session.timeZone && session.timeZone !== browserTimeZone) {
        const keepDestination = await dialog({ message: t('Auth.TimeZone') });
        if (!keepDestination) { await navigate('/mypreferences', { replace: true }); return; }
      }
      await navigate(session.isLimitedSession ? '/changepassword' : returnTo, {
        replace: true, state: { returnTo, afterLogin: !session.isLimitedSession },
      });
    } catch (failure) {
      activated.current = false;
      if (isOtpChallenge(failure)) {
        setOtp(true);
        if (useCode) setError(t('Auth.OtpFailed'));
      } else if (failure instanceof LoginChallengeFailure) {
        setError(t('Auth.ChallengeFailed'));
      } else setError(useCode ? t('Auth.OtpFailed') : t('Common.Failed'));
      setValues(current => ({ ...current, otpCode: '' }));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (state.stage === 'authenticated' && !activated.current) {
    return <Navigate replace to={state.session.isLimitedSession ? '/changepassword' : returnTo}
      state={{ returnTo, afterLogin: !state.session.isLimitedSession }} />;
  }
  if (state.stage === 'loading') return <StatusPanel kind="loading" />;

  function closeOtp() {
    if (!busy.current) { setOtp(false); setError(''); setValues({ ...values, password: '', otpCode: '' }); }
  }

  return <Panel className="workspace-login">
    <div className="workspace-login-heading">
      <div className="workspace-login-brand"><img src="/images/dcplogo.svg" alt="DCP" /></div>
      <h1>{t('Auth.SignInTitle')}</h1>
    </div>
    {state.stage === 'error' && <div className="mb-4"><StatusPanel kind="error" error={state.error} retry={() => void restore()} /></div>}
    <form noValidate className="grid gap-4" onSubmit={event => { event.preventDefault(); void submit(false); }}>
      <Field label={t('UserName', undefined, 'Core')} autoComplete="username" value={values.userName}
        onChange={userName => { setErrors(current => ({ ...current, userName: '' })); setValues({ ...values, userName }); }} error={errors.userName} />
      <Field label={t('Password', undefined, 'Core')} type="password" autoComplete="current-password" value={values.password}
        onChange={password => { setErrors(current => ({ ...current, password: '' })); setValues({ ...values, password }); }} error={errors.password} />
      {error && !otp && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Link to="/resetpassword" className="justify-self-end text-sm font-medium text-primary underline-offset-2 hover:underline">{t('Auth.Forgot')}</Link>
      <Button type="submit" disabled={pending} className="workspace-login-button">{t('Page.Login')}</Button>
    </form>
    {otp && <Modal title={t('Auth.Code')} onClose={closeOtp}>
      <form noValidate className="grid gap-4" onSubmit={event => { event.preventDefault(); void submit(true); }}>
        <Field label={t('Auth.Code')} value={values.otpCode} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          onChange={otpCode => { setErrors(current => ({ ...current, otpCode: '' })); setValues({ ...values, otpCode }); }} error={errors.otpCode} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="workspace-popup-actions">
          <Button onClick={closeOtp} disabled={pending}>{t('Cancel', undefined, 'Core')}</Button>
          <Button type="submit" variant="primary" disabled={pending}>{t('Auth.Verify')}</Button>
        </div>
      </form>
    </Modal>}
  </Panel>;
}

export function ResetPasswordPage() {
  const { t } = useGlobalization();
  return <Page id="ResetPassword" title={t('Page.ResetPassword')}>
    <div className="grid gap-4">
      <p>{t('Auth.ResetUnavailable')}</p>
      <Link to="/login" className="justify-self-start text-sm font-medium text-primary hover:underline">{t('Page.Login')}</Link>
    </div>
  </Page>;
}

export function ChangePasswordPage() {
  const session = useSession();
  const { t, error } = useGlobalization();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useEditForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState(false);
  const limited = session.state.stage === 'authenticated' && session.state.session.isLimitedSession;
  async function submit() {
    await form.submit(values => {
      const invalid: Record<string, string> = {};
      if (!values.oldPassword) invalid.oldPassword = t('Common.Required');
      if (!values.newPassword) invalid.newPassword = t('Common.Required');
      if (!values.confirmPassword || values.newPassword !== values.confirmPassword) {
        invalid.confirmPassword = t('Common.PasswordMatch');
      }
      return invalid;
    }, async values => {
      await changePassword(session.http, values.oldPassword, values.newPassword);
      return { oldPassword: '', newPassword: '', confirmPassword: '' };
    }, failure => toast.error(error(failure, true)), () => {
      setDone(true);
      toast.success(t('Common.Saved'));
      if (limited) void session.refreshSession().then(updated => {
        if (updated.isLimitedSession) { void session.logout(); return; }
        void navigate(safeReturnPath(location.state?.returnTo), { replace: true, state: { afterLogin: true } });
      }).catch(() => { void session.logout(); });
    });
  }
  if (done) return <Panel className="p-6">
    <p role="status" className="mb-4">{t('Common.Saved')}</p>
    <Button variant="primary" onClick={() => void navigate(safeReturnPath(location.state?.returnTo), {
      replace: true, state: { afterLogin: true },
    })}>{t('Common.Home')}</Button>
  </Panel>;
  return <Page id="ChangePassword" title={t('Page.ChangePassword')}>
    <form noValidate className="grid gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <ToolbarBar>
        <Button variant="ghost" className="workspace-toolbar-button" type="submit" disabled={form.pending}><KeyRound />{t('Page.ChangePassword')}</Button>
        {limited ? <Button variant="ghost" className="workspace-toolbar-button" disabled={form.pending} onClick={() => void session.logout()}>{t('Page.Logout')}</Button>
          : <ClosePageButton disabled={form.pending} />}
      </ToolbarBar>
      {limited && <p className="text-sm">{t('Auth.Limited')}</p>}
      <div className="workspace-fields workspace-compact-fields grid gap-3">
        {([
          ['oldPassword', 'Field.CurrentPassword'], ['newPassword', 'Field.NewPassword'], ['confirmPassword', 'Field.ConfirmPassword'],
        ] as const).map(([key, label]) => <Field key={key} label={t(label)} type="password"
          autoComplete={key === 'oldPassword' ? 'current-password' : 'new-password'} value={form.values[key]}
          onChange={value => form.change(key, value)} error={form.errors[key]} />)}
      </div>
    </form>
  </Page>;
}
