import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { commandWithData, logoutView, sessionView, type SessionView } from '@/shared/contracts';
import { ApiFailure, confirmCommand, HttpClientManager } from '@/shared/http';
import { logManager } from '@/shared/log';

type SessionState = { stage: 'loading' | 'anonymous' } | { stage: 'error'; error: unknown } |
  { stage: 'authenticated'; session: SessionView };

interface SessionContextValue {
  state: SessionState;
  http: HttpClientManager;
  restore: () => Promise<void>;
  login: (credentials: { userName: string; password: string; otpCode?: string }) => Promise<SessionView>;
  logout: () => Promise<boolean>;
  refreshSession: () => Promise<SessionView>;
  applyPresentation: (preferences: { language?: string | null; timeZone?: string | null; displayName?: string | null }) => void;
}
const SessionContext = createContext<SessionContextValue | null>(null);

export class LoginChallengeFailure extends Error {
  constructor(cause?: ApiFailure) {
    super('Could not obtain a valid sign-in challenge', { cause });
    this.name = 'LoginChallengeFailure';
  }
}

export async function getLoginChallenge(http: HttpClientManager) {
  try {
    await http.json('/api/session', sessionView, { protected: false });
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    const challenge = error.info.challenge;
    if (error.status === 401 && challenge && Date.parse(challenge.expiresAtUtc) > Date.now()) return challenge;
    throw new LoginChallengeFailure(error);
  }
  throw new LoginChallengeFailure();
}

export function sessionDeadline(session: Pick<SessionView, 'expireAtUtc' | 'idleExpireAtUtc'>) {
  return Math.min(Date.parse(session.expireAtUtc), Date.parse(session.idleExpireAtUtc));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ stage: 'loading' });
  const current = useRef<SessionView | undefined>(undefined);
  const revision = useRef(0);
  const logoutTask = useRef<Promise<boolean> | null>(null);
  const publish = useCallback((session?: SessionView) => {
    current.current = session;
    setState(session ? { stage: 'authenticated', session } : { stage: 'anonymous' });
  }, []);
  const http = useMemo(() => new HttpClientManager(() => current.current?.csrfToken, () => {
    revision.current++;
    publish();
  }, undefined, idleExpireAtUtc => {
    const session = current.current;
    if (!session) return;
    const deadline = Date.parse(idleExpireAtUtc);
    if (deadline > Date.parse(session.idleExpireAtUtc) && deadline <= Date.parse(session.expireAtUtc)) {
      publish({ ...session, idleExpireAtUtc });
    }
  }), [publish]);

  const load = useCallback((signal?: AbortSignal) =>
    http.json('/api/session', sessionView, { protected: false, signal }), [http]);
  const restore = useCallback(async (signal?: AbortSignal) => {
    const attempt = ++revision.current;
    setState({ stage: 'loading' });
    try {
      const session = await load(signal);
      if (attempt === revision.current) publish(sessionDeadline(session) > Date.now() ? session : undefined);
    } catch (error) {
      if (signal?.aborted || attempt !== revision.current) return;
      if (error instanceof ApiFailure && error.status === 401) publish();
      else setState({ stage: 'error', error });
    }
  }, [load, publish]);
  useEffect(() => {
    const controller = new AbortController();
    void restore(controller.signal);
    return () => controller.abort();
  }, [restore]);

  const logout = useCallback(() => {
    if (logoutTask.current) return logoutTask.current;
    const session = current.current;
    revision.current++;
    publish();
    if (!session) return Promise.resolve(true);
    const operation = http.json('/api/session/logout', commandWithData(logoutView), {
      method: 'POST', csrf: session.csrfToken, protected: false,
    }).then(result => {
      const data = confirmCommand(result).data;
      return data?.localClosed === true && ['confirmed', 'revoked', 'succeeded'].includes(String(data.revocationStatus).toLowerCase());
    }).catch(() => {
      logManager.write({ level: 'warn', category: 'session', operation: 'Logout', outcome: 'failure' });
      return false;
    }).finally(() => { logoutTask.current = null; });
    logoutTask.current = operation;
    return operation;
  }, [http, publish]);

  const active = state.stage === 'authenticated' ? state.session : undefined;
  useEffect(() => {
    if (!active) return;
    let expiry: number;
    const check = () => {
      if (!current.current) return;
      const time = sessionDeadline(current.current) - Date.now();
      if (time <= 0) void logout();
      else expiry = window.setTimeout(check, Math.min(time, 2_147_483_647));
    };
    check();
    return () => window.clearTimeout(expiry);
  }, [active, logout]);

  async function login(credentials: { userName: string; password: string; otpCode?: string }) {
    const attempt = ++revision.current;
    const challenge = await getLoginChallenge(http);
    const session = await http.json('/api/session/login', sessionView, {
      method: 'POST', body: credentials, csrf: challenge.csrfToken, protected: false,
    });
    if (attempt !== revision.current || sessionDeadline(session) <= Date.now()) throw new ApiFailure('http', 401);
    publish(session);
    return session;
  }

  async function refreshSession() {
    const attempt = ++revision.current;
    const session = await load();
    if (attempt !== revision.current || sessionDeadline(session) <= Date.now()) throw new ApiFailure('http', 401);
    publish(session);
    return session;
  }

  const applyPresentation: SessionContextValue['applyPresentation'] = preferences => {
    const session = current.current;
    if (!session) return;
    publish({ ...session, language: preferences.language ?? session.language,
      timeZone: preferences.timeZone ?? session.timeZone, displayName: preferences.displayName ?? session.displayName });
  };
  return <SessionContext.Provider value={{ state, http, restore, login, logout, refreshSession, applyPresentation }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is required');
  return session;
}

const protectedRoutes = new Set([
  '/index', '/myprofile', '/mypreferences', '/mysessions', '/contact', '/licence', '/about', '/userlistpage',
]);

export function safeReturnPath(value: unknown) {
  if (typeof value !== 'string' || !/^\/[a-z]+(?:\?[^#]*)?$/.test(value)) return '/index';
  return protectedRoutes.has(value.split('?')[0]) ? value : '/index';
}

export function isOtpChallenge(error: unknown) {
  if (!(error instanceof ApiFailure)) return false;
  const code = z.string().safeParse(error.code);
  return code.success && ['OTPVALIDATIONREQUIRED', 'OTP_REQUIRED', 'OTPVALIDATIONREQUIREDEXCEPTION']
    .includes(code.data.replaceAll('.', '').toUpperCase()) || error.info.receiveTimeAsSeconds !== undefined;
}
