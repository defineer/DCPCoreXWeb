import { expect, test, type Locator, type Page } from '@playwright/test';

const future = '2099-01-01T00:00:00Z';
const signedIn = {
  userId: 7, customerId: 1, userName: 'ada', displayName: 'Ada Lovelace', language: 'en-US', timeZone: 'UTC',
  isLimitedSession: false, expireAtUtc: future, idleExpireAtUtc: future, csrfToken: 'fixture-session',
};
const preferences = {
  userId: 7, photo: null, displayName: 'Ada Lovelace', language: 'en-US', timeZone: 'UTC',
  twoFactorAuthentication: false, saveAndCloseBehaviour: true, sessionTimeoutAsSeconds: 1200,
  defaultApplicationId: 10, defaultPageId: 0, notifyBeforeSessionClosedAsSec: 60,
  theme: 'Light', menuCollapsed: false, menuPosition: 1, rowsPerPage: 20, gridPagerPosition: 'Bottom',
};
const node = (elementId: number, parentElementId: number, keyName: string, elementTypeKeyName: string,
  visible = false, elementName = keyName) => ({
  elementId, parentElementId, keyName, elementTypeKeyName, elementName, listOrder: elementId,
  accessRight: 1, isApplication: elementTypeKeyName === 'Application', elementContent: JSON.stringify({ isMenuVisible: visible }),
});
const elements = [
  node(10, 0, 'CoreApplication', 'Application', false, 'Core Application'),
  node(11, 10, 'SecurityWebUI', 'WebUIModule', false, 'Security'),
  node(12, 11, 'WebUserList', 'WebForm', true),
  node(13, 11, 'WebUserEdit', 'WebForm'),
  node(14, 12, 'WebAddUser', 'WebFormAction'),
  node(15, 12, 'WebViewUser', 'WebFormAction'),
  node(16, 12, 'WebEditUser', 'WebFormAction'),
  node(17, 12, 'WebDeleteUser', 'WebFormAction'),
  node(18, 13, 'WebSaveUser', 'WebFormAction'),
  node(19, 12, 'WebExportUsers', 'WebFormAction'),
  node(20, 11, 'WebObjectDocuments', 'WebForm'),
  node(21, 13, 'WebViewObjectDocument.UserEdit', 'WebFormAction'),
  node(22, 13, 'WebAddObjectDocument.UserEdit', 'WebFormAction'),
  node(23, 13, 'WebDeleteObjectDocument.UserEdit', 'WebFormAction'),
];
const documentName = 'Document'.repeat(65) + '.png';
const fixturePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/R2sAAAAASUVORK5CYII=';
const userRow = { id: 8, userName: 'grace', nameSurname: 'Grace Hopper', email: 'grace@example.test', isActive: true };
const userDetail = { ...userRow, gender: 2, birthDate: '1906-12-09T00:00:00', phone: '5550123456',
  countryId: 1, countryRegionId: 0, cityId: 2, isBlocked: false, isSingleUsablePassword: false, isDeleted: false };

async function mockApi(page: Page, options: { authenticated?: boolean; denied?: boolean; top?: boolean; limited?: boolean } = {}) {
  let authenticated = options.authenticated ?? true;
  let limited = options.limited ?? false;
  let saves = 0;
  let deletes = 0;
  let passwordChanges = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    async function reply(json: unknown, status = 200) { await route.fulfill({ json, status }); }
    switch (path) {
      case '/api/session':
        return authenticated ? reply({ ...signedIn, isLimitedSession: limited })
          : reply({ challenge: { csrfToken: 'fixture-prelogin', expiresAtUtc: future } }, 401);
      case '/api/session/login':
        if (request.headers()['x-dcp-csrf'] !== 'fixture-prelogin') return reply({}, 403);
        if (request.postDataJSON().otpCode !== '123456') return reply({ errorCode: 'OTP_REQUIRED', receiveTimeAsSeconds: 120 }, 428);
        authenticated = true;
        return reply({ ...signedIn, isLimitedSession: limited });
      case '/api/userservice/changepassword':
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        passwordChanges++;
        limited = false;
        return reply({ success: true });
      case '/api/userservice/getuserpreferencesweb':
        return reply({ ...preferences, menuPosition: options.top ? 'Top' : 'Left' });
      case '/api/userservice/getuserprofile':
        return reply({ ...userDetail, id: signedIn.userId, userName: signedIn.userName, email: 'ada@example.test' });
      case '/api/userservice/getusersessions':
        return reply({ data: [{ startDate: '2025-01-01T12:00:00Z', isSuccess: true }], totalRecords: 1 });
      case '/api/userservice/getuseraccessibleelements':
        return reply(options.denied ? elements.slice(0, 2) : elements);
      case '/api/customerservice/getcustomerlicencessimple':
        return reply([{ customerId: 1, licenceId: 3 }]);
      case '/api/customerservice/getlicenceapplicationsssimple':
        return reply([{ licenceId: 3, applicationId: 10, applicationName: 'Core' }]);
      case '/api/customerservice/getcustomerlicenceinfo':
        return reply({ licenceName: 'Core', licenceTypeName: 'Core', startDate: '2025-01-01', endDate: '2099-01-01', isTrial: false, maxUserCount: 50 });
      case '/api/customerservice/getownercustomer':
        return reply({ name: 'DCP', infoMail: 'info@example.test', supportMail: 'support@example.test' });
      case '/api/userservice/getuserspaged':
        return reply({ data: deletes ? [] : [userRow], totalRecords: deletes ? 0 : 1 });
      case '/api/userservice/getuser':
        return reply(userDetail);
      case '/api/document/getobjectdocuments':
        return reply([{ documentId: 42, documentName, isDeleted: false }]);
      case '/api/document/downloadobjectdocument':
        return route.fulfill({ contentType: 'image/png', body: Buffer.from(fixturePng, 'base64') });
      case '/api/globalentityservice/getcountriessimple':
        return reply([{ id: 1, countryName: 'Türkiye' }]);
      case '/api/globalentityservice/getcountryregionssimple':
        return reply([]);
      case '/api/globalentityservice/getcitiessimple':
        return reply([{ id: 2, countryId: 1, countryRegionId: 0, cityName: 'Istanbul' }]);
      case '/api/userservice/saveuser':
        saves++;
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        return reply({ success: true, data: 8 });
      case '/api/userservice/deleteuser':
        deletes++;
        return reply({ success: true });
      default:
        return reply({}, 404);
    }
  });
  return { saves: () => saves, deletes: () => deletes, passwordChanges: () => passwordChanges };
}

const responsiveSizes = [
  { name: 'mobile', width: 320, height: 640 },
  { name: 'landscape mobile', width: 568, height: 320 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function expectWithinViewport(locator: Locator, viewport: { width: number; height: number }, vertical = false) {
  await expect(locator).toBeVisible();
  const bounds = (await locator.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  if (vertical) {
    expect(bounds.y).toBeGreaterThanOrEqual(-1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

async function expectNoPageOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const viewport of responsiveSizes) {
  test(`fits every signed-in route and its available menus on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { top: viewport.name === 'mobile' });
    await page.route('**/api/userservice/getusersessions', route => route.fulfill({
      json: { data: [{ startDate: '2025-01-01T12:00:00Z', isSuccess: true }], totalRecords: 60 },
    }));
    await page.setViewportSize(viewport);
    for (const [path, title] of [
      ['/index', 'Home'], ['/myprofile', 'User Profile'], ['/mypreferences', 'My Preferences'],
      ['/mysessions', 'Sessions'], ['/changepassword', 'Change password'], ['/contact', 'Contact'],
      ['/licence', 'Licence'], ['/about', 'About'], ['/userlistpage', 'Users List'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
      if (path === '/myprofile') await expect(page.getByLabel('Full name')).toBeVisible();
      if (path === '/mypreferences') await expect(page.getByRole('group', { name: 'General' })).toBeVisible();
      if (path === '/mysessions' || path === '/userlistpage') {
        const grid = page.locator('.workspace-table');
        await expect(grid.getByRole('row')).toHaveCount(2);
        await expectWithinViewport(grid, viewport);
        if (viewport.width < 640) {
          await grid.press('ArrowRight');
          await expect.poll(() => grid.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
          await grid.evaluate(element => { element.scrollLeft = 0; });
        }
        if (path === '/mysessions') {
          await expectWithinViewport(page.getByRole('spinbutton', { name: 'Page number' }), viewport);
          await expectWithinViewport(page.getByRole('button', { name: 'Last page' }), viewport);
        }
      }
      await expectNoPageOverflow(page, viewport.width);
    }
    const actions = page.getByRole('group', { name: 'Actions' });
    await actions.getByRole('button', { name: 'Export current page' }).click();
    await expectWithinViewport(actions.getByRole('button', { name: 'XLSX', exact: true }), viewport);
    await expectNoPageOverflow(page, viewport.width);
    const account = page.locator('header summary[aria-label="Ada Lovelace"]');
    await account.click();
    await expectWithinViewport(account.locator('+ .workspace-nav-popup'), viewport, true);
    await page.getByRole('button', { name: 'Sign out' }).scrollIntoViewIfNeeded();
    await expectWithinViewport(page.getByRole('button', { name: 'Sign out' }), viewport, true);
    await page.getByRole('link', { name: 'About' }).click();
    const applications = page.locator('header summary[aria-label="Applications"]');
    await applications.click();
    await expectWithinViewport(page.getByRole('button', { name: 'Core Application' }), viewport);
    if (viewport.name === 'mobile') {
      await applications.click();
      const navigation = page.getByRole('navigation', { name: 'Workspace' });
      await navigation.locator('summary').first().click();
      await expectWithinViewport(navigation.getByRole('link', { name: 'User Management' }), viewport, true);
      await expectNoPageOverflow(page, viewport.width);
    }
    for (const [path, message] of [
      ['/error', 'Something went wrong'], ['/access-denied', 'Access denied'], ['/missing-audit-page', 'Page or record not found'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('alert')).toHaveText(message);
      await expectWithinViewport(page.getByRole('alert'), viewport);
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test(`fits authentication and user dialogs on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.setViewportSize(viewport);
    await page.goto('/resetpassword');
    await expectWithinViewport(page.getByRole('link', { name: 'Oturum aç' }), viewport, true);
    await expectNoPageOverflow(page, viewport.width);
    await page.goto('/userlistpage');
    await page.getByLabel(/kullanıcı adı/i).fill('ada');
    await page.getByLabel(/^şifre$/i).fill('fixture-password');
    await expectNoPageOverflow(page, viewport.width);
    await page.getByRole('button', { name: 'Oturum aç' }).click();
    const otp = page.getByRole('dialog');
    await expectWithinViewport(otp, viewport, true);
    await otp.getByRole('textbox').fill('123456');
    await otp.getByRole('button', { name: 'Doğrula' }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const editor = page.getByRole('dialog');
    await expectWithinViewport(editor, viewport, true);
    await editor.getByLabel('Full name').fill('Unsaved name');
    const modalBody = editor.locator('.workspace-page-body');
    await modalBody.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const close = editor.getByRole('button', { name: 'Close', exact: true }).first();
    await expectWithinViewport(close, viewport, true);
    await close.click();
    const discard = page.getByRole('alertdialog');
    await expectWithinViewport(discard, viewport, true);
    await discard.getByRole('button', { name: 'Discard changes' }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await expectWithinViewport(editor, viewport, true);
    await editor.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit user' });
    await expectWithinViewport(edit, viewport, true);
    await edit.getByRole('button', { name: 'Documents', exact: true }).click();
    const documents = page.getByRole('dialog', { name: 'Documents', exact: true });
    await expectWithinViewport(documents, viewport, true);
    await expectWithinViewport(documents.getByRole('table'), viewport);
    await expectWithinViewport(documents.locator('input[type="file"]'), viewport);
    await documents.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByRole('dialog', { name: documentName });
    await expectWithinViewport(preview, viewport, true);
    await expectWithinViewport(preview.getByRole('heading'), viewport, true);
    await expectWithinViewport(preview.getByRole('img'), viewport);
    await preview.getByRole('button', { name: 'Close' }).click();
    await documents.getByRole('button', { name: 'Delete' }).click();
    const deletion = page.getByRole('alertdialog');
    await expectWithinViewport(deletion, viewport, true);
    await expectWithinViewport(deletion.getByRole('button', { name: 'Cancel' }), viewport, true);
    await deletion.getByRole('button', { name: 'Cancel' }).click();
    await expectNoPageOverflow(page, viewport.width);
  });
}

test('requires login and OTP before restoring a protected destination', async ({ page }) => {
  await mockApi(page, { authenticated: false });
  await page.goto('/userlistpage');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel(/kullanıcı adı/i)).toHaveCSS('min-height', '48px');
  await page.getByLabel(/kullanıcı adı/i).fill('ada');
  await page.getByLabel(/^şifre$/i).fill('fixture-password');
  await page.getByRole('button', { name: 'Oturum aç' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Doğrulama kodu' }).fill('123456');
  await page.getByRole('button', { name: 'Doğrula' }).click();
  await expect(page.getByRole('heading', { name: 'Users List', exact: true })).toBeVisible();
  await expect(page.getByText('Grace Hopper')).toBeVisible();
});

test('uses the Blazor palette, page structure, and hover states', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1916, height: 940 });
  await page.goto('/index');
  await expect(page.getByRole('banner')).toHaveCSS('background-color', 'rgb(225, 227, 232)');
  await expect(page.locator('#left-navigation')).toHaveCSS('background-color', 'rgb(225, 227, 232)');
  const homePanels = page.locator('main section');
  await expect(homePanels).toHaveCount(2);
  await expect(homePanels.first()).toContainText('Start date');
  await expect(homePanels.last()).toContainText('Time zone');
  await page.getByRole('main').getByRole('link', { name: 'My Profile' }).click();
  await expect(page).toHaveURL(/\/myprofile$/);
  await expect(page.getByLabel(/^Email$/i)).toHaveValue('ada@example.test');
  await expect(page.getByRole('group', { name: 'General', exact: true })).toContainText('Last password change');
  await expect(page.getByRole('group', { name: 'Contact', exact: true })).toContainText('Email');
  await expect(page.getByRole('group', { name: 'Actions' }).getByRole('button', { name: 'Save' })).toBeVisible();

  await page.locator('header summary[aria-label="Ada Lovelace"]').click();
  await page.getByRole('link', { name: 'My Sessions' }).click();
  await expect(page).toHaveURL(/\/mysessions$/);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'Query' })).toBeVisible();

  await page.goto('/userlistpage');
  await expect(page.getByRole('heading', { name: 'Users List' }).locator('..')).toHaveCSS('background-color', 'rgb(128, 73, 184)');
  await expect(page.getByRole('heading', { name: 'Query' })).toHaveCSS('background-color', 'rgb(155, 108, 199)');
  const activeMenu = page.getByRole('link', { name: 'User Management' });
  await expect(activeMenu).toHaveCSS('background-color', 'rgb(112, 56, 173)');
  const module = page.locator('#left-navigation summary').first();
  for (const control of [module, activeMenu, page.getByRole('button', { name: 'New', exact: true })]) {
    await control.hover();
    await expect(control).toHaveCSS('background-color', 'rgb(232, 221, 242)');
    await expect(control).toHaveCSS('color', 'rgb(69, 33, 112)');
  }
  await expect(activeMenu).toHaveCSS('background-color', 'rgb(112, 56, 173)');
  const newButton = page.getByRole('button', { name: 'New', exact: true });
  await expect(newButton.locator('.workspace-icon')).toHaveCSS('background-color', 'rgb(69, 33, 112)');
  const row = page.getByRole('row', { name: /Grace Hopper/ });
  await row.hover();
  await expect(row).toHaveCSS('background-color', 'rgb(232, 221, 242)');
  await row.click();
  await expect(row).toHaveCSS('background-color', 'rgb(232, 221, 242)');
  await expect(row).toHaveCSS('color', 'rgb(33, 37, 41)');
  await page.locator('header summary[aria-label="Ada Lovelace"]').click();
  await page.getByRole('link', { name: 'My Profile' }).click();
  await expect(activeMenu).toBeVisible();
});

test('keeps single-column account fields compact beneath the desktop toolbar', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1916, height: 940 });
  for (const path of ['/contact', '/licence', '/about', '/changepassword']) {
    await page.goto(path);
    const toolbar = page.getByRole('group', { name: 'Actions' });
    const fields = page.locator('.workspace-compact-fields');
    await expect(fields).toHaveCSS('width', '672px');
    expect(await fields.evaluate(element => element.getBoundingClientRect().left)).toBe(
      await toolbar.evaluate(element => element.getBoundingClientRect().left),
    );
    expect(await toolbar.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(1000);
  }
});

test('fits profile, preference and session fields inside their groups', async ({ page }) => {
  await mockApi(page);
  for (const [path, groupSelector] of [
    ['/myprofile', '.workspace-account-groups > fieldset'],
    ['/mypreferences', '.workspace-account-groups > fieldset'],
    ['/mysessions', '.workspace-list-split > section'],
  ]) {
    await page.goto(path);
    const groups = page.locator(groupSelector);
    await expect(groups).toHaveCount(2);
    for (const width of [2560, 1916, 800, 390]) {
      await page.setViewportSize({ width, height: 940 });
      const [first, second] = await groups.evaluateAll(elements => elements.map(group => {
        const { left, right, top, bottom, width } = group.getBoundingClientRect();
        const controls = Array.from(group.querySelectorAll('.workspace-control, .workspace-readonly dd'), control => {
          const { left, right, top, bottom } = control.getBoundingClientRect();
          return { left, right, top, bottom };
        });
        return { left, right, top, bottom, width, controls };
      }));
      expect(first.width).toBeLessThanOrEqual(path === '/mysessions' ? 544 : 832);
      expect(first.controls.length).toBeGreaterThan(0);
      if (path !== '/mysessions') {
        expect(second.width).toBeCloseTo(first.width, 0);
        expect(second.controls.length).toBeGreaterThan(0);
      }
      for (const group of [first, second]) {
        for (const control of group.controls) {
          expect(control.left).toBeGreaterThan(group.left);
          expect(control.right).toBeLessThan(group.right);
          expect(control.top).toBeGreaterThan(group.top);
          expect(control.bottom).toBeLessThan(group.bottom);
        }
      }
      if (width >= 1916) {
        expect(second.left).toBeGreaterThan(first.right);
        expect(second.top).toBe(first.top);
        if (path === '/mysessions') expect(second.width).toBeGreaterThan(first.width * 1.9);
      } else {
        expect(second.left).toBe(first.left);
        expect(second.top).toBeGreaterThan(first.bottom);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  }
});

test('shows the shared layout on account pages and keeps the mobile drawer usable', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, title] of [
    ['/mypreferences', 'My Preferences'], ['/contact', 'Contact'], ['/licence', 'Licence'], ['/about', 'About'],
    ['/changepassword', 'Change password'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Actions' }).getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
  const sidebar = page.locator('#left-navigation');
  await expect(sidebar).not.toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await sidebar.locator('summary').first().click();
  await sidebar.getByRole('link', { name: 'User Management' }).click();
  await expect(page.getByRole('heading', { name: 'Users List' })).toBeVisible();
  await expect(sidebar).not.toBeVisible();
});

test('keeps credentials local when the anonymous session response has no challenge', async ({ page }) => {
  await mockApi(page, { authenticated: false });
  await page.route('**/api/session', route => route.fulfill({ status: 401, json: {} }));
  const loginRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/session/login') loginRequests.push(request.method());
  });

  await page.goto('/login');
  await page.getByLabel(/kullanıcı adı/i).fill('ada');
  await page.getByLabel(/^şifre$/i).fill('fixture-password');
  await page.getByRole('button', { name: 'Oturum aç' }).click();

  await expect(page.getByRole('alert')).toHaveText('Oturum açma işlemi başlatılamadı. Lütfen daha sonra tekrar deneyin.');
  expect(loginRequests).toHaveLength(0);
});

test('uses icon-only collapse, preserves an edited form, and saves through the same shared dialog', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/userlistpage');
  await expect(page.getByRole('heading', { name: 'Users List', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await expect(nav.getByText('Security Management')).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(nav.getByText('Security Management')).toHaveCount(0);
  await expect(nav.locator('summary[aria-label="Security Management"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit user' });
  await editor.getByLabel('Full name').fill('Grace B. Hopper');
  await expect(editor.getByLabel('Full name')).toHaveAttribute('data-valid', 'true');
  await editor.getByRole('button', { name: 'Close', exact: true }).last().click();
  const discard = page.getByRole('alertdialog');
  await expect(discard.getByText('Discard unsaved changes?')).toBeVisible();
  await expect(discard.getByRole('heading')).toHaveCSS('background-color', 'rgb(225, 227, 232)');
  await discard.getByRole('button', { name: 'Continue editing' }).click();
  await expect(editor.getByLabel('Full name')).toHaveValue('Grace B. Hopper');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toHaveCount(0);
  expect(api.saves()).toBe(1);
  const toast = page.locator('[data-sonner-toast][data-type="success"]');
  await expect(toast).toContainText('Changes saved.');
  await expect(toast).toHaveAttribute('data-rich-colors', 'true');
  await expect(toast).toHaveCSS('width', '320px');
  await toast.getByRole('button', { name: 'Close' }).click();
  await expect(toast).toHaveCount(0);
});

test('shades the loading grid, resizes adjacent columns, and jumps to a session page', async ({ page }) => {
  await mockApi(page);
  let releaseUsers!: () => void;
  const pendingUsers = new Promise<void>(resolve => { releaseUsers = resolve; });
  await page.route('**/api/userservice/getuserspaged', async route => {
    await pendingUsers;
    await route.fallback();
  }, { times: 1 });
  await page.route('**/api/userservice/getusersessions', async route => {
    const { dataFilter } = route.request().postDataJSON();
    await route.fulfill({ json: { data: [{ startDate: `2025-01-0${dataFilter.page}T12:00:00Z`, isSuccess: false }], totalRecords: 60 } });
  });

  await page.goto('/userlistpage');
  try {
    await expect(page.locator('.workspace-loading-overlay')).toContainText('Loading');
    await expect(page.locator('.workspace-loading-region [aria-busy="true"]')).toHaveAttribute('inert', '');
  } finally { releaseUsers(); }

  const handle = page.getByRole('separator', { name: 'Resize User Name column' });
  await expect(handle).toBeVisible();
  const header = handle.locator('..');
  const original = (await header.boundingBox())!.width;
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 42, bounds.y + bounds.height / 2, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(original + 35);
  await handle.press('ArrowLeft');
  await expect.poll(async () => (await header.boundingBox())!.width).toBeLessThan(original + 30);

  await page.goto('/mysessions');
  const pageNumber = page.getByRole('spinbutton', { name: 'Page number' });
  await pageNumber.fill('3');
  await pageNumber.press('Enter');
  await expect(page.getByText('Page 3 of 3 · 60 records')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last page' })).toBeDisabled();
});

test('validates dropped photos and submits a replacement through the preference form', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/userservice/saveuserpreferencesweb', route => route.fulfill({ json: { success: true } }));
  await page.goto('/mypreferences');
  const dropZone = page.locator('.workspace-photo-drop');
  const invalid = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['fixture'], 'fixture.txt', { type: 'text/plain' }));
    return data;
  });
  await dropZone.dispatchEvent('drop', { dataTransfer: invalid });
  await expect(page.getByRole('alert')).toContainText('Select a supported file type and size.');
  const photo = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/R2sAAAAASUVORK5CYII='), byte => byte.charCodeAt(0));
    data.items.add(new File([png], 'fixture.png', { type: 'image/png' }));
    return data;
  });
  await dropZone.dispatchEvent('drop', { dataTransfer: photo });
  await expect(dropZone.locator('img')).toHaveAttribute('src', /^blob:/);
  const save = page.waitForRequest('**/api/userservice/saveuserpreferencesweb');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await save).postData()).toContain('filename="fixture.png"');
  await expect(page.locator('[data-sonner-toast]')).toContainText('Changes saved.');
});

test('cancels a delete without a request and verifies the exported PDF header', async ({ page }) => {
  const api = await mockApi(page, { top: true });
  await page.goto('/userlistpage');
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(api.deletes()).toBe(0);
  await page.getByRole('button', { name: 'Export current page' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('users-page-1.pdf');
  const stream = await file.createReadStream();
  expect(stream).toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');
});

test('denies direct navigation without the configured page grant', async ({ page }) => {
  await mockApi(page, { denied: true });
  await page.goto('/userlistpage');
  await expect(page.getByRole('alert')).toHaveText('Access denied');
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('shows recovery help without calling the legacy reset action', async ({ page }) => {
  await mockApi(page, { authenticated: false });
  const resetRequests: string[] = [];
  page.on('request', request => {
    if (/\/userservice\/resetpassword\/?$/i.test(new URL(request.url()).pathname)) resetRequests.push(request.url());
  });

  await page.goto('/login');
  await page.getByRole('link', { name: 'Parolanızı mı unuttunuz?' }).click();
  await expect(page).toHaveURL(/\/resetpassword$/);
  await expect(page.getByText(/parola kurtarma şu anda kullanılamıyor/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-posta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Parolayı sıfırla' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Oturum aç' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(resetRequests).toEqual([]);
});

test('requires password change before a limited session can use the signed-in shell', async ({ page }) => {
  const api = await mockApi(page, { limited: true });
  await page.goto('/userlistpage');
  await expect(page).toHaveURL(/\/changepassword$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByLabel('Current password').fill('fixture-current');
  await page.getByLabel('New password', { exact: true }).fill('fixture-new');
  await page.getByLabel('Confirm password').fill('fixture-new');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('heading', { name: 'Users List', exact: true })).toBeVisible();
  expect(api.passwordChanges()).toBe(1);
});
