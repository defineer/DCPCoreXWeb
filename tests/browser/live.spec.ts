import { expect, test } from '@playwright/test';

test('serves the deployed application over HTTPS and rejects an anonymous session', async ({ page, request, baseURL }) => {
  expect(new URL(baseURL!).protocol).toBe('https:');
  const session = await request.get('/api/session', { maxRedirects: 0 });
  expect(session.status()).toBe(401);
  await page.goto('/userlistpage');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /oturum aç/i })).toBeVisible();
});

test('anonymous session status supplies a pre-login challenge in a secure cookie', async ({ request }) => {
  const session = await request.get('/api/session', { maxRedirects: 0 });
  expect(session.status()).toBe(401);
  const { challenge } = await session.json();
  expect(challenge.csrfToken).toEqual(expect.any(String));
  expect(Date.parse(challenge.expiresAtUtc)).toBeGreaterThan(Date.now());
  const cookie = session.headers()['set-cookie'];
  expect(cookie).toMatch(/\bSecure\b/i);
  expect(cookie).toMatch(/\bHttpOnly\b/i);
  expect(cookie).toMatch(/\bSameSite=Lax\b/i);
  expect(cookie).not.toMatch(/\bDomain=/i);
});

test('protected operations require authority and the HTTPS page sends security headers', async ({ request }) => {
  const auth = await request.get('/login', { maxRedirects: 0 });
  expect(auth.ok()).toBe(true);
  expect(auth.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(auth.headers()['x-content-type-options']).toBe('nosniff');
  const read = await request.post('/api/userservice/getuserspaged', {
    data: { recordStatusQueryType: 1, dataFilter: { page: 1, pageSize: 10 } }, maxRedirects: 0,
  });
  expect([401, 403]).toContain(read.status());
  const logout = await request.post('/api/session/logout', { maxRedirects: 0 });
  expect([401, 403]).toContain(logout.status());
});
