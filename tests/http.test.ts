// @vitest-environment node

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { genericResponse } from '@/shared/contracts';
import { confirmCommand, HttpClientManager } from '@/shared/http';

const origin = 'http://localhost';
const handlers = setupServer();
beforeAll(() => handlers.listen({ onUnhandledRequest: 'error' }));
afterEach(() => handlers.resetHandlers());
afterAll(() => handlers.close());

function client(csrf?: string, unauthorized = vi.fn()) {
  return new HttpClientManager(() => csrf, unauthorized,
    (input, init) => fetch(new URL(String(input), origin), init));
}

it('adds CSRF and multipart fields to the same-origin modifying request', async () => {
  handlers.use(http.post(origin + '/api/userservice/saveuserpreferencesweb', async ({ request }) => {
    expect(request.headers.get('X-DCP-CSRF')).toBe('fixture-token');
    const body = await request.formData();
    expect(body.get('userPreferences')).toBe('{"language":"en-US"}');
    return HttpResponse.json({ success: true });
  }));
  const body = new FormData();
  body.set('userPreferences', '{"language":"en-US"}');
  const response = await client('fixture-token').json('/api/userservice/saveuserpreferencesweb',
    genericResponse, { method: 'POST', body });
  expect(confirmCommand(response).success).toBe(true);
});

it('clears local authority on protected authentication failure', async () => {
  const expired = vi.fn();
  handlers.use(http.get(origin + '/api/userservice/getuser', () => HttpResponse.json({}, { status: 401 })));
  await expect(client('fixture-token', expired).json('/api/userservice/getuser', genericResponse)).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledOnce();
});

it('rejects modifying requests with no CSRF before transport', async () => {
  await expect(client().json('/api/userservice/saveuser', genericResponse, { method: 'POST' }))
    .rejects.toMatchObject({ status: 401 });
});
