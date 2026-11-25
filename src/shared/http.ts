import { z } from 'zod';
import { exceptionResponse } from './contracts';

export type ApiFailureKind = 'http' | 'transport' | 'timeout' | 'invalid-response' | 'command';

export class ApiFailure extends Error {
  constructor(
    public readonly kind: ApiFailureKind,
    public readonly status = 0,
    public readonly info: z.infer<typeof exceptionResponse> = {},
  ) {
    super(kind);
    this.name = 'ApiFailure';
  }

  get code() {
    return this.info.code ?? this.info.errorCode;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  csrf?: string;
  protected?: boolean;
  modifying?: boolean;
  signal?: AbortSignal;
}

export function assertApiPath(path: string) {
  if (!/^\/api\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*(?:\?[^#]*)?$/.test(path)) {
    throw new TypeError('Expected a same-origin API operation path');
  }
}

export function withQuery(path: string, values: Record<string, string | number>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => search.set(key, String(value)));
  return path + '?' + search;
}

export function confirmCommand<T extends { success: boolean; message?: string | null }>(result: T): T {
  if (!result.success) throw new ApiFailure('command', 0, { message: result.message ?? undefined });
  return result;
}

export class HttpClientManager {
  constructor(
    private readonly getCsrf: () => string | undefined,
    private readonly onUnauthorized: () => void,
    private readonly transport: typeof fetch = (...args) => fetch(...args),
    private readonly onIdleDeadline?: (deadline: string) => void,
  ) {}

  private async request<T>(
    path: string,
    options: RequestOptions,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    assertApiPath(path);
    const method = options.method ?? 'GET';
    const requiresCsrf = options.modifying ?? (method === 'POST');
    const renewIdle = requiresCsrf && options.protected !== false;
    const csrf = options.csrf ?? this.getCsrf();
    if (requiresCsrf && !csrf) throw new ApiFailure('http', 401);
    const headers = new Headers({ Accept: 'application/json, application/octet-stream' });
    if (requiresCsrf && csrf) headers.set('X-DCP-CSRF', csrf);
    if (renewIdle) headers.set('X-DCP-Activity', '1');
    const multipart = options.body instanceof FormData;
    if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
    const timeout = AbortSignal.timeout(20_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response | undefined;
    try {
      response = await this.transport(path, {
        method, headers, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal,
        body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        const parsed = exceptionResponse.safeParse(data);
        if (response.status === 401 && options.protected !== false && this.getCsrf() === csrf) {
          this.onUnauthorized();
        }
        throw new ApiFailure('http', response.status, parsed.success ? parsed.data : {});
      }
      const result = await read(response);
      const idleDeadline = renewIdle ? response.headers.get('X-DCP-Idle-Expires-At') : null;
      if (idleDeadline && this.getCsrf() === csrf) this.onIdleDeadline?.(idleDeadline);
      return result;
    } catch (error) {
      if (error instanceof ApiFailure || options.signal?.aborted) throw error;
      if (timeout.aborted) throw new ApiFailure('timeout');
      throw new ApiFailure(response ? 'invalid-response' : 'transport');
    }
  }

  json<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    return this.request(path, options, async response => schema.parse(await response.json()));
  }

  file(path: string, options: RequestOptions = {}) {
    return this.request(path, options, async response => {
      const mime = response.headers.get('content-type')?.split(';')[0] ?? '';
      if (!mime || mime === 'text/html' || mime === 'application/json') throw new ApiFailure('invalid-response');
      const disposition = response.headers.get('content-disposition') ?? '';
      const encodedName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const name = encodedName ? decodeURIComponent(encodedName) : /filename="?([^";]+)"?/i.exec(disposition)?.[1];
      const safeName = name && [...name].map(character => character < ' ' || '\\/'.includes(character) ? '_' : character).join('');
      return { blob: await response.blob(), name: safeName, mime };
    });
  }
}

export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
