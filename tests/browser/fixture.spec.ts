import { chromium, expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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
  node(20, 841, 'WebObjectDocuments', 'WebForm'),
  node(21, 13, 'WebViewObjectDocument.UserEdit', 'WebFormAction'),
  node(22, 13, 'WebAddObjectDocument.UserEdit', 'WebFormAction'),
  node(23, 13, 'WebDeleteObjectDocument.UserEdit', 'WebFormAction'),
  node(24, 11, 'WebUserRolesList', 'WebForm'),
  node(25, 11, 'WebAccessModelTreeList', 'WebForm'),
  node(26, 12, 'WebListUserRoles', 'WebFormAction'),
  node(27, 12, 'WebListUserAccessModels', 'WebFormAction'),
  node(28, 11, 'WebRoleList', 'WebForm', true),
  node(29, 11, 'WebRoleUsersList', 'WebForm'),
  node(30, 28, 'WebListRoleUsers', 'WebFormAction'),
  node(31, 28, 'WebListRoleAccessModels', 'WebFormAction'),
  node(32, 11, 'WebWorkgroupTreeList', 'WebForm', true),
  node(33, 11, 'WebWorkgroupUsersList', 'WebForm'),
  node(34, 32, 'WebListWorkgroupUsers', 'WebFormAction'),
  node(35, 32, 'WebListWorkgroupAccessModels', 'WebFormAction'),
  node(36, 11, 'WebRoleEdit', 'WebForm'),
  node(37, 28, 'WebViewRole', 'WebFormAction'),
  node(38, 11, 'WebWorkgroupEdit', 'WebForm'),
  node(39, 32, 'WebViewWorkgroup', 'WebFormAction'),
  node(40, 25, 'WebSaveAccessModels', 'WebFormAction'),
  node(41, 28, 'WebAddRole', 'WebFormAction'),
  node(42, 28, 'WebEditRole', 'WebFormAction'),
  node(43, 28, 'WebDeleteRole', 'WebFormAction'),
  node(44, 36, 'WebSaveRole', 'WebFormAction'),
  node(45, 32, 'WebAddWorkgroup', 'WebFormAction'),
  node(46, 32, 'WebEditWorkgroup', 'WebFormAction'),
  node(47, 32, 'WebDeleteWorkgroup', 'WebFormAction'),
  node(48, 38, 'WebSaveWorkgroup', 'WebFormAction'),
  ...(['UserRole', 'RoleUser', 'WorkgroupUser'] as const).flatMap((member, index) => {
    const editor = 49 + 6 * index;
    const list = [24, 29, 33][index];
    return [
      node(editor, 11, 'Web' + member + 'Edit', 'WebForm'),
      ...['Add', 'Edit', 'View', 'Delete'].map((action, offset) => node(editor + offset + 1, list, 'Web' + action + member, 'WebFormAction')),
      node(editor + 5, editor, 'WebSave' + member, 'WebFormAction'),
    ];
  }),
  node(70, 10, 'ConfigurationWebUI', 'WebUIModule', false, 'Configuration'),
  node(71, 70, 'WebCustomerList', 'WebForm', true),
  node(72, 70, 'WebCustomerLicenceList', 'WebForm'),
  node(73, 70, 'WebLicenceList', 'WebForm', true),
  node(74, 71, 'WebListCustomerLicences', 'WebFormAction'),
  node(84, 70, 'WebLicenceEdit', 'WebForm'),
  node(85, 73, 'WebViewLicence', 'WebFormAction'),
  node(86, 70, 'WebCustomerLicenceEdit', 'WebForm'),
  node(87, 72, 'WebViewCustomerLicence', 'WebFormAction'),
];
const documentName = 'Document'.repeat(65) + '.png';
const fixturePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/R2sAAAAASUVORK5CYII=';
const userRow = { id: 8, userName: 'grace', nameSurname: 'Grace Hopper', email: 'grace@example.test', isActive: true };
const membership = { id: 41, isPrimary: true, startDate: '2025-07-01T00:00:00Z', endDate: null, isActive: true };
const membershipFixtures = [
  { service: 'userservice', stem: 'userrole', idKey: 'userRoleId', parentKey: 'userId', parentId: 8,
    otherKey: 'roleId', firstOther: 9, secondOther: 91, secondName: 'Audit Role', nameKey: 'roleName', firstName: 'Operations',
    choiceOperation: 'getusernotassignedroles', route: '/userroleslistpage?userId=8', field: 'Role', noun: 'Role membership' },
  { service: 'roleservice', stem: 'roleuser', idKey: 'roleUserId', parentKey: 'roleId', parentId: 9,
    otherKey: 'userId', firstOther: 8, secondOther: 7, secondName: 'Ada Lovelace', nameKey: 'userName', firstName: 'Grace Hopper',
    choiceOperation: 'getrolenotassignedusers', route: '/roleuserslistpage?roleId=9', field: 'User', noun: 'Role membership' },
  { service: 'workgroupservice', stem: 'workgroupuser', idKey: 'workgroupUserId', parentKey: 'workgroupId', parentId: 10,
    otherKey: 'userId', firstOther: 8, secondOther: 7, secondName: 'Ada Lovelace', nameKey: 'userName', firstName: 'Grace Hopper',
    choiceOperation: 'getworkgroupnotassignedusers', route: '/workgroupuserslistpage?workgroupId=10', field: 'User',
    noun: 'Workgroup membership' },
] as const;
const userDetail = { ...userRow, gender: 'Female', birthDate: '1906-12-09T00:00:00', phone: '5550123456',
  countryId: 1, countryRegionId: 0, cityId: 2, isBlocked: false, isSingleUsablePassword: false, isDeleted: false };

const ownerRoutes = [
  ['WebServiceDashboard', '/servicedashboard', 'Service dashboard', 'servicemanagement/getservicelist'],
  ['WebCacheItemList', '/cacheitemlistformpage', 'Cache items', 'cacheservice/getallitems'],
  ['WebQueueList', '/queuelistformpage', 'Queues', 'queueservice/getqueuelist'],
  ['WebTableList', '/tablelistformpage', 'Runtime tables', 'memorytableservice/gettablelist'],
  ['WebJsonObjectList', '/jsonobjectlistpage', 'JSON object management', 'jsonobject/getjsonobjecttypessimple'],
  ['WebAgentDashboard', '/agentdashboard', 'Agent dashboard', 'agent/getagentsinfo'],
  ['WebAIFrameworkDashboard', '/aiframeworkdashboard', 'AI framework dashboard', 'aiframework/querycommandactivitykpisummary'],
  ['WebAIProviderDashboard', '/aiproviderdashboard', 'AI provider dashboard', 'aiframework/queryproviderdashboardkpisummary'],
  ['WebAICommandActivityList', '/aicommandactivitylist', 'AI command activities', 'aiframework/getproviderssimple'],
  ['WebWorkflowInbox', '/workflowinboxpage', 'Workflow inbox', 'workflow/getworkflowinbox'],
  ['WebSQLClient', '/sqlclient', 'SQL client', 'report/connections'],
] as const;
const date = '2026-01-10T08:00:00Z';
const workflowInboxRow = { workflowObjectId: '9007199254740993', workflowObjectTransitionId: '9007199254740994',
    workflowTypeId: 2, objectId: '9007199254740995', objectTypeId: 1, objectTypeName: 'Fixture object', currentStateName: 'In progress',
    canExecuteActions: true, isTerminalState: false, isInitialState: false, allowsDelegation: true,
    currentStateId: 2, currentNodeNumber: 1, currentWorkflowTypeStateId: 3 };

const ownerResponses: Record<string, unknown> = {
  'servicemanagement/getservicelist': [{ serviceId: 'configuration', serviceName: 'Configuration', serviceIP: '127.0.0.1', port: 9100, startTime: date }],
  'event/queryeventsanalysis': [{ name: 'Configuration', minResponseTimeMs: 2, maxResponseTimeMs: 9, avgResponseTimeMs: 4 }],
  'event/queryeventscount': [{ name: 'Configuration', count: 20 }],
  'cacheservice/getallitems': [{ key: 'FixtureCacheKey' }],
  'cacheservice/getcacheitem': 'Fixture value',
  'queueservice/getqueuelist': [{ queueName: 'Queue:Fixture', elementCount: 1 }],
  'queueservice/getqueueitemlist': [{ key: 'fixture', itemValue: '{"content":"Queued item"}' }],
  'memorytableservice/gettablelist': [{ tableName: 'FixtureTable', elementCount: 1 }],
  'memorytableservice/gettablerowlist': [{ key: 'fixture', itemValue: 'Runtime item' }],
  'jsonobject/getjsonobjecttypessimple': [{ id: 3, typeName: 'Document', isActive: true }],
  'jsonobject/getjsonobjects': [{ id: '9007199254740993', objectName: 'Fixture JSON object', jsonObjectTypeName: 'Document', isActive: true }],
  'agent/getagentsinfo': [{ agentId: '9007199254740993', agentName: 'Fixture Agent', agentServiceIP: '127.0.0.1',
    agentPort: 9800, agentTypeKeyName: 'FullAgent', startTime: date }],
  'agent/getagentscountbytype': [{ name: 'FullAgent', count: 1 }],
  'aiframework/querycommandactivitykpisummary': { totalCommands: 1, totalInputUnits: '9007199254740993', totalOutputUnits: '2', averageDurationMs: 8 },
  'aiframework/queryproviderdashboardkpisummary': { providersCount: 1, mostActiveProviderCommandCount: 1,
    fastestProviderAvgDurationMs: 8, mostReliableProviderSuccessRate: 100 },
  'aiframework/getcommandactivityusers': { users: [], canReadAcrossTenants: false },
  'aiframework/getproviderssimple': [],
  'aiframework/getmodelssimple': [],
  'workflow/getworkflowinbox': [workflowInboxRow],
  'workflow/getobjectworkflowhistory': [{ workflowAction: 'Next', stateName: 'In progress', startDate: date, userName: 'Ada' }],
  'report/connections': ['FixtureReportReadOnly'],
  'report/executesqlcommand': [{ 'Value': 'Fixture result' }],
};

async function mockApi(page: Page, options: {
  authenticated?: boolean; denied?: boolean; top?: boolean; limited?: boolean;
  excludedGrants?: string[]; saveAndClose?: boolean; accessConflict?: boolean;
  customerId?: number;
  accessModelDialog?: boolean;
  duplicateAccessGrant?: boolean;
  customerMaintenance?: boolean;
  licenceMaintenance?: boolean;
  customerLicenceMaintenance?: boolean;
  assetManagement?: boolean;
  eventManagement?: boolean;
  configurationVersions?: boolean;
  ownerPages?: boolean;
} = {}) {
  const customerId = options.customerId ?? signedIn.customerId;
  let authenticated = options.authenticated ?? true;
  let limited = options.limited ?? false;
  let saves = 0;
  let deletes = 0;
  let passwordChanges = 0;
  let directoryGrantActive = true;
  const customers = new Map([
    [1, { id: 1, customerName: 'Acme', customerTypeName: 'Business', customerTypeId: 1 }],
    [2, { id: 2, customerName: 'Example Institute', customerTypeName: 'Education', customerTypeId: 2 }],
  ]);
  const licences = new Map([[3, { id: 3, licenceName: 'Core Annual', additionalPeriodAsDays: 10, isActive: true, isDeleted: false,
    licenceApplications: [{ id: 21, licenceId: 3, applicationId: 10, isActive: true, isDeleted: false }],
  }]]);
  const applications = [{ id: 10, name: 'Core' }, { id: 11, name: 'Operations' }];
  let nextMapping = 22;
  const assets = new Map([['9007199254740993', {
    id: '9007199254740993', identifier: 'A-001', assetName: 'Laptop', assetTypeId: 1,
    assetTypeName: 'Equipment', isActive: true, isDeleted: false, features: '{"serial":"ABC"}',
  }]]);
  const events = new Map([[46, {
    id: 46, eventName: 'Session opened', keyName: 'SessionOpened', eventTypeId: 1, eventTypeName: 'Session',
    severityId: 'Information', processManagerKeyName: 'Default', isSystemEvent: true, isActive: true, isDeleted: false,
  }]]);
  const customerLicences = new Map([[81, {
    id: 81, customerId: 1, licenceId: 3, licenceTypeId: 1, licenceName: 'Core Annual', licenceTypeName: 'Annual',
    maxUserCount: 50, additionalPeriodAsDays: 10, isTrial: false, isActive: true, isDeleted: false,
    startDate: '2025-01-01T00:00:00Z', endDate: '2099-01-01T00:00:00Z',
    startDateWithOffset: '2025-01-01T08:30:32.123456+00:00', endDateWithOffset: '2099-01-01T17:45:00+00:00',
  }]]);
  const roles = new Map([[9, { id: 9, roleName: 'Operations', keyName: 'operations', isActive: true, isDeleted: false }]]);
  const workgroups = new Map([
    [10, { id: 10, workgroupName: 'Main Office', keyName: 'main-office',
      parentWorkgroupId: null, parentWorkgroupName: null, isActive: true, isDeleted: false }],
    [11, { id: 11, workgroupName: 'Operations Team', keyName: 'operations-team',
      parentWorkgroupId: 10, parentWorkgroupName: 'Main Office', isActive: true, isDeleted: false }],
  ]);
  const memberRows = membershipFixtures.map(spec => new Map([[41, {
    ...membership, [spec.parentKey]: spec.parentId, [spec.otherKey]: spec.firstOther,
    [spec.nameKey]: spec.firstName, isDeleted: false,
  }]]));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    async function reply(json: unknown, status = 200) { await route.fulfill({ json, status }); }
    const params = new URL(request.url()).searchParams;
    const ownerOperation = path.slice('/api/'.length);
    if (options.ownerPages && (ownerOperation in ownerResponses || ownerOperation.startsWith('aiframework/query'))) {
      expect(request.headers().authorization).toBeUndefined();
      if (request.method() === 'POST') expect(request.headers()['x-dcp-csrf']).toBe('fixture-session');
      return reply(ownerResponses[ownerOperation] ?? []);
    }
    for (const [index, spec] of membershipFixtures.entries()) {
      const prefix = '/api/' + spec.service + '/';
      if (!path.startsWith(prefix)) continue;
      const leaf = path.slice(prefix.length);
      const rows = memberRows[index];
      const memberId = Number(params.get(spec.idKey));
      if (leaf === 'get' + (spec.stem === 'userrole' ? 'userroles' : spec.stem + 's')) {
        return request.postDataJSON()[spec.parentKey] === spec.parentId ? reply([...rows.values()]) : reply({}, 403);
      }
      if (leaf === spec.choiceOperation) {
        return Number(params.get(spec.parentKey)) === spec.parentId
          ? reply([{ id: spec.secondOther, name: spec.secondName }]) : reply({}, 403);
      }
      if (leaf === 'get' + spec.stem) {
        const value = rows.get(memberId);
        return value && Number(params.get('scopeId')) === spec.parentId ? reply(value) : reply({}, 404);
      }
      if (leaf === 'save' + spec.stem || leaf === 'delete' + spec.stem) {
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session' || Number(params.get('scopeId')) !== spec.parentId)
          return reply({}, 403);
        if (leaf === 'delete' + spec.stem) return rows.delete(memberId) ? reply({ success: true }) : reply({}, 404);
        const body = request.postDataJSON();
        if (body[spec.parentKey] !== spec.parentId || !body.startDateWithOffset || (body.id && !rows.has(body.id)))
          return reply({}, 409);
        const id = body.id || 71 + index;
        rows.set(id, { ...body, id, startDate: body.startDateWithOffset, endDate: body.endDateWithOffset,
          isPrimary: body.isPrimary ?? false,
          [spec.nameKey]: body[spec.otherKey] === spec.secondOther ? spec.secondName : spec.firstName });
        return reply({ success: true, data: id });
      }
    }
    switch (path) {
      case '/api/session':
        return authenticated ? reply({ ...signedIn, customerId, isLimitedSession: limited })
          : reply({ challenge: { csrfToken: 'fixture-prelogin', expiresAtUtc: future } }, 401);
      case '/api/session/login':
        if (request.headers()['x-dcp-csrf'] !== 'fixture-prelogin') return reply({}, 403);
        if (request.postDataJSON().otpCode !== '123456') return reply({ errorCode: 'OTP_REQUIRED', receiveTimeAsSeconds: 120 }, 428);
        authenticated = true;
        return reply({ ...signedIn, customerId, isLimitedSession: limited });
      case '/api/userservice/changepassword':
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        passwordChanges++;
        limited = false;
        return reply({ success: true });
      case '/api/userservice/getuserpreferencesweb':
        return reply({ ...preferences, menuPosition: options.top ? 'Top' : 'Left',
          saveAndCloseBehaviour: options.saveAndClose ?? preferences.saveAndCloseBehaviour });
      case '/api/userservice/getuserprofile':
        return reply({ ...userDetail, id: signedIn.userId, userName: signedIn.userName, email: 'ada@example.test' });
      case '/api/userservice/getusersessions':
        return reply({ data: [{ startDate: '2025-01-01T12:00:00Z', isSuccess: true }], totalRecords: 1 });
      case '/api/userservice/getuseraccessibleelements':
        return reply(options.denied ? elements.slice(0, 2)
          : [...elements, ...(options.accessModelDialog ? [
            node(75, 11, 'WebAccessModelEdit', 'WebForm'),
            node(76, 25, 'WebViewAccessModel', 'WebFormAction'),
            node(77, 25, 'WebEditAccessModel', 'WebFormAction'),
            node(78, 75, 'WebSaveAccessModel', 'WebFormAction'),
          ] : []), ...(options.customerMaintenance ? [
            node(79, 70, 'WebCustomerEdit', 'WebForm'),
            node(80, 71, 'WebViewCustomer', 'WebFormAction'),
            node(81, 71, 'WebEditCustomer', 'WebFormAction'),
            node(82, 71, 'WebDeleteCustomer', 'WebFormAction'),
            node(83, 79, 'WebSaveCustomer', 'WebFormAction'),
            node(150, 71, 'WebAddCustomer', 'WebFormAction'),
          ] : []), ...(options.licenceMaintenance ? [
            node(88, 73, 'WebAddLicence', 'WebFormAction'),
            node(89, 73, 'WebEditLicence', 'WebFormAction'),
            node(90, 73, 'WebDeleteLicence', 'WebFormAction'),
            node(91, 84, 'WebSaveLicence', 'WebFormAction'),
          ] : []), ...(options.customerLicenceMaintenance ? [
            node(92, 72, 'WebAddCustomerLicence', 'WebFormAction'),
            node(93, 72, 'WebEditCustomerLicence', 'WebFormAction'),
            node(94, 72, 'WebDeleteCustomerLicence', 'WebFormAction'),
            node(95, 86, 'WebSaveCustomerLicence', 'WebFormAction'),
          ] : []), ...(options.assetManagement ? [
            node(96, 10, 'AssetWebUI', 'WebUIModule', false, 'Assets'),
            node(97, 96, 'WebAssetList', 'WebForm', true),
            node(98, 96, 'WebAssetDashboard', 'WebForm', true),
            node(99, 96, 'WebAssetEdit', 'WebForm'),
            node(100, 97, 'WebAddAsset', 'WebFormAction'),
            node(101, 97, 'WebEditAsset', 'WebFormAction'),
            node(102, 97, 'WebDeleteAsset', 'WebFormAction'),
            node(103, 97, 'WebViewAsset', 'WebFormAction'),
            node(104, 99, 'WebSaveAsset', 'WebFormAction'),
          ] : []), ...(options.eventManagement ? [
            node(105, 10, 'EventWebUI', 'WebUIModule', false, 'Events'),
            node(106, 105, 'WebEventList', 'WebForm', true),
            node(107, 105, 'WebEventDashboard', 'WebForm', true),
            node(108, 105, 'WebEventEdit', 'WebForm'),
            node(109, 106, 'WebAddEvent', 'WebFormAction'),
            node(110, 106, 'WebEditEvent', 'WebFormAction'),
            node(111, 106, 'WebDeleteEvent', 'WebFormAction'),
            node(112, 106, 'WebViewEvent', 'WebFormAction'),
            node(113, 108, 'WebSaveEvent', 'WebFormAction'),
            node(145, 105, 'WebEventObjectList', 'WebForm', true),
          ] : []), ...(options.configurationVersions ? [
            node(146, 70, 'WebConfigurationElementList', 'WebForm', true),
            node(147, 146, 'WebListVersionsConfigurationElement', 'WebFormAction'),
            node(148, 70, 'WebConfigurationElementVersionList', 'WebForm'),
            node(149, 148, 'WebDeleteConfigurationElementVersion', 'WebFormAction'),
            node(151, 70, 'WebConfigurationElementVersionEdit', 'WebForm'),
            node(152, 148, 'WebAddConfigurationElementVersion', 'WebFormAction'),
            node(153, 148, 'WebViewConfigurationElementVersion', 'WebFormAction'),
            node(154, 148, 'WebEditConfigurationElementVersion', 'WebFormAction'),
            node(155, 151, 'WebSaveConfigurationElementVersion', 'WebFormAction'),
          ] : []), ...(options.ownerPages ? [
            node(120, 10, 'OwnerModule', 'WebUIModule'),
            ...ownerRoutes.map(([key], index) => node(121 + index, 120, key, 'WebForm', true)),
            node(133, 120, 'WebCacheItemDetail', 'WebForm'),
            node(134, 122, 'WebViewCacheItem', 'WebFormAction'),
            node(135, 120, 'WebQueueItemList', 'WebForm'),
            node(136, 123, 'WebListQueueItems', 'WebFormAction'),
            node(137, 120, 'WebTableRowList', 'WebForm'),
            node(138, 124, 'WebListTableRows', 'WebFormAction'),
            node(139, 130, 'WebWorkflowInboxHistory', 'WebFormAction'),
            node(140, 130, 'WebOpenWorkflowObject', 'WebFormAction'),
            node(141, 130, 'WebWorkflowInboxNext', 'WebFormAction'),
            node(142, 130, 'WebWorkflowInboxRestart', 'WebFormAction'),
            node(143, 130, 'WebWorkflowInboxCancel', 'WebFormAction'),
            node(144, 130, 'WebWorkflowInboxCompleted', 'WebFormAction'),
          ] : [])].filter(element => !options.excludedGrants?.includes(element.keyName)));
      case '/api/customerservice/getcustomerlicencessimple':
        return reply([{ customerId, licenceId: 3 }]);
      case '/api/assetservice/getassettypessimple':
        return reply([{ id: 1, name: 'Equipment', isActive: true }, { id: 2, name: 'Legacy', isActive: false }]);
      case '/api/assetservice/getassets': {
        const { assetType } = request.postDataJSON();
        return reply([...assets.values()].filter(item => assetType === -1 || item.assetTypeId === assetType));
      }
      case '/api/assetservice/getasset': {
        const asset = assets.get(params.get('assetId') ?? '');
        return asset ? reply(asset) : reply({}, 404);
      }
      case '/api/assetservice/saveasset': {
        const body = request.postDataJSON();
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session' ||
          (body.id !== '0' && !assets.has(body.id))) return reply({}, 403);
        const id = body.id === '0' ? '9007199254740995' : body.id;
        assets.set(id, { ...body, id, assetTypeName: 'Equipment' });
        return reply({ success: true, data: id });
      }
      case '/api/assetservice/deleteasset':
        return request.headers()['x-dcp-csrf'] === 'fixture-session' && assets.delete(params.get('assetId') ?? '')
          ? reply({ success: true }) : reply({}, 403);
      case '/api/assetservice/getassettypescount':
        return reply([{ name: 'Equipment', count: 7 }, { name: 'Other', count: 3 }]);
      case '/api/event/getwebeventdashboard':
        return reply({ rootGroups: [{ name: 'Platform', count: 12 }], groups: [{ name: 'Security', count: 12 }],
          eventTypes: [{ name: 'Login', count: 12 }] });
      case '/api/event/getevents':
        return reply([...events.values()]);
      case '/api/event/getevent': {
        const event = events.get(Number(params.get('eventId')));
        return event ? reply(event) : reply({}, 404);
      }
      case '/api/event/geteventtypessimple':
        return reply([{ id: 1, name: 'Session' }]);
      case '/api/event/saveevent': {
        const body = request.postDataJSON();
        if (customerId !== 0 || request.headers()['x-dcp-csrf'] !== 'fixture-session' ||
          (body.id && !events.has(body.id))) return reply({}, 403);
        const id = body.id || 47;
        events.set(id, { ...body, id, eventTypeName: 'Session' });
        return reply({ success: true, data: id });
      }
      case '/api/event/deleteevent':
        return customerId === 0 && request.headers()['x-dcp-csrf'] === 'fixture-session' &&
          events.delete(Number(params.get('eventId'))) ? reply({ success: true }) : reply({}, 403);
      case '/api/customerservice/getcustomers': {
        const rows = [...customers.values()];
        const { customerType } = request.postDataJSON();
        return reply(customerId === 0
          ? rows.filter(row => customerType === -1 || row.customerTypeId === customerType)
          : rows.filter(row => row.id === customerId));
      }
      case '/api/customerservice/getcustomer': {
        const id = Number(params.get('customerId'));
        if (customerId !== 0 && customerId !== id) return reply({}, 403);
        const row = customers.get(id);
        return row ? reply({ ...row, keyName: 'example-customer', countryId: 1, countryRegionId: 0, cityId: 2,
          infoEmail: 'info@example.test', supportEmail: 'support@example.test', phone: '5550123456',
          language: 'en-US', timeZone: 'UTC', isActive: true, isDeleted: false }) : reply({}, 404);
      }
      case '/api/customerservice/savecustomer': {
        const body = request.postDataJSON();
        const row = customers.get(body.id);
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session' || !row || (customerId !== 0 && customerId !== body.id))
          return reply({}, 403);
        customers.set(row.id, { ...row, ...body });
        return reply({ success: true, data: row.id });
      }
      case '/api/customerservice/deletecustomer': {
        const id = Number(params.get('customerId'));
        return (customerId === 0 || customerId === id) && request.headers()['x-dcp-csrf'] === 'fixture-session' &&
          customers.delete(id) ? reply({ success: true }) : reply({}, 403);
      }
      case '/api/customerservice/getcustomertypessimple':
        return reply([{ id: 1, name: 'Business' }, { id: 2, name: 'Education' }]);
      case '/api/customerservice/getlicences':
        return reply([...licences.values()]);
      case '/api/customerservice/getlicence': {
        const licence = licences.get(Number(params.get('licenceId')));
        return licence ? reply(licence) : reply({}, 404);
      }
      case '/api/customerservice/getweblicenceapplications':
        return customerId === 0 ? reply(applications) : reply({}, 403);
      case '/api/customerservice/savelicence': {
        const { licenceApplications, ...body } = request.postDataJSON();
        if (customerId !== 0 || request.headers()['x-dcp-csrf'] !== 'fixture-session' ||
          (body.id ? !licences.has(body.id) : licenceApplications.length > 0)) return reply({}, 403);
        const id = body.id || 4;
        const rows = new Map(licences.get(id)?.licenceApplications.map(row => [row.id, row]));
        for (const row of licenceApplications) {
          if (row.licenceId !== id || (row.id && !rows.has(row.id))) return reply({}, 400);
          const mappingId = row.id || nextMapping++;
          rows.set(mappingId, { ...row, id: mappingId });
        }
        licences.set(id, { ...body, id, licenceApplications: [...rows.values()] });
        return reply({ success: true, data: id });
      }
      case '/api/customerservice/deletelicence':
        return customerId === 0 && request.headers()['x-dcp-csrf'] === 'fixture-session' &&
          licences.delete(Number(params.get('licenceId'))) ? reply({ success: true }) : reply({}, 403);
      case '/api/customerservice/getcustomerlicences':
        return customerId === 0 && request.postDataJSON().customerId === 1
          ? reply([...customerLicences.values()])
          : reply({}, 403);
      case '/api/customerservice/getcustomerlicence': {
        const record = customerLicences.get(Number(params.get('customerLicenceId')));
        return customerId === 0 && params.get('customerId') === '1' && record ? reply(record) : reply({}, 404);
      }
      case '/api/customerservice/getwebcustomerlicencechoices':
        return customerId === 0 && params.get('customerId') === '1'
          ? reply({ licences: [{ id: 3, name: 'Core Annual' }], licenceTypes: [{ id: 1, name: 'Annual' }] })
          : reply({}, 403);
      case '/api/customerservice/savecustomerlicence': {
        const body = request.postDataJSON();
        if (customerId !== 0 || params.get('customerId') !== '1' || body.customerId !== 1 ||
          request.headers()['x-dcp-csrf'] !== 'fixture-session' || (body.id && !customerLicences.has(body.id))) return reply({}, 403);
        const id = body.id || 82;
        customerLicences.set(id, { ...body, id, licenceName: 'Core Annual', licenceTypeName: 'Annual',
          startDate: body.startDateWithOffset, endDate: body.endDateWithOffset });
        return reply({ success: true, data: id });
      }
      case '/api/customerservice/deletecustomerlicence':
        return customerId === 0 && params.get('customerId') === '1' && request.headers()['x-dcp-csrf'] === 'fixture-session' &&
          customerLicences.delete(Number(params.get('customerLicenceId'))) ? reply({ success: true }) : reply({}, 403);
      case '/api/customerservice/getlicenceapplicationsssimple':
        return reply([...licences.values()].flatMap(licence => licence.licenceApplications.filter(row => row.isActive)
          .map(row => ({ licenceId: licence.id, applicationId: row.applicationId,
            applicationName: applications.find(app => app.id === row.applicationId)?.name }))));
      case '/api/customerservice/getcustomerlicenceinfo':
        return reply({ licenceName: 'Core', licenceTypeName: 'Core', startDate: '2025-01-01', endDate: '2099-01-01', isTrial: false, maxUserCount: 50 });
      case '/api/customerservice/getownercustomer':
        return reply({ name: 'DCP', infoMail: 'info@example.test', supportMail: 'support@example.test' });
      case '/api/userservice/getuserspaged':
        return reply({ data: deletes ? [] : [userRow], totalRecords: deletes ? 0 : 1 });
      case '/api/userservice/getuser':
        return reply(userDetail);
      case '/api/roleservice/getroles':
        return reply([...roles.values()]);
      case '/api/roleservice/getrole': {
        const role = roles.get(Number(new URL(request.url()).searchParams.get('roleId')));
        return role ? reply(role) : reply({}, 404);
      }
      case '/api/roleservice/saverole': {
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        const role = request.postDataJSON();
        if (role.id && !roles.has(role.id)) return reply({}, 404);
        const id = role.id || 91;
        roles.set(id, { ...role, id });
        return reply({ success: true, data: id });
      }
      case '/api/roleservice/deleterole': {
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        const id = Number(new URL(request.url()).searchParams.get('roleId'));
        return roles.delete(id) ? reply({ success: true }) : reply({}, 404);
      }
      case '/api/workgroupservice/getworkgroups':
        return reply([...workgroups.values()]);
      case '/api/workgroupservice/getworkgroup': {
        const group = workgroups.get(Number(new URL(request.url()).searchParams.get('workgroupId')));
        return group ? reply(group) : reply({}, 404);
      }
      case '/api/workgroupservice/hasrootworkgroup':
        return reply([...workgroups.values()].some(group => group.parentWorkgroupId == null));
      case '/api/workgroupservice/saveworkgroup': {
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        const group = request.postDataJSON();
        if (group.id && !workgroups.has(group.id)) return reply({}, 404);
        const id = group.id || 92;
        workgroups.set(id, { ...group, id, parentWorkgroupName: workgroups.get(group.parentWorkgroupId)?.workgroupName ?? null });
        return reply({ success: true, data: id });
      }
      case '/api/workgroupservice/deleteworkgroup': {
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session') return reply({}, 403);
        const id = Number(new URL(request.url()).searchParams.get('workgroupId'));
        return workgroups.delete(id) ? reply({ success: true }) : reply({}, 404);
      }
      case '/api/accessservice/getaccessmodels': {
        const { userId, roleId, workgroupId } = request.postDataJSON();
        if (userId !== 8 && roleId !== 9 && workgroupId !== 10) return reply({}, 403);
        const state = { checked: true, isActive: true, isDeleted: false, accessRight: 'Execute' };
        return reply([
          { ...state, id: 1, accessModelId: 101, parentConfigurationElementId: 0, elementName: 'Security', configurationElementTypeName: 'Module' },
          { ...state, id: 2, accessModelId: 102, parentConfigurationElementId: 1, elementName: 'Directory', configurationElementTypeName: 'Page',
            checked: directoryGrantActive, isActive: directoryGrantActive },
          ...(options.duplicateAccessGrant ? [{ ...state, id: 3, accessModelId: 0, hasMultipleGrants: true,
            parentConfigurationElementId: 2, elementName: 'Duplicate action', configurationElementTypeName: 'Action' }] : []),
        ]);
      }
      case '/api/accessservice/savewebaccessmodels': {
        const { scope, changes } = request.postDataJSON();
        if (request.headers()['x-dcp-csrf'] !== 'fixture-session' || scope.userId !== 8 ||
          changes.length !== 1 || changes[0].grantId !== 102 || changes[0].elementId !== 2) return reply({}, 403);
        if (options.accessConflict) return reply({}, 409);
        directoryGrantActive = changes[0].isActive;
        return reply({ success: true });
      }
      case '/api/accessservice/getaccessmodel':
        return params.get('userId') === '8' && params.get('elementId') === '2' && params.get('accessModelId') === '102'
          ? reply({ id: 102, isActive: directoryGrantActive, isDeleted: false, insertedBy: 7, insertedDate: future })
          : reply({}, 404);
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

for (const viewport of responsiveSizes) {
  test('opens all remaining owner service routes on ' + viewport.name, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await mockApi(page, { customerId: 0, ownerPages: true });
    for (const [, path, title, operation] of ownerRoutes) {
      const request = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/' + operation);
      await page.goto(path);
      expect((await request).ok()).toBe(true);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test('fits Workflow history and transition dialogs on ' + viewport.name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page, { ownerPages: true });
    await page.route('**/api/workflow/getnextstates?*', route => route.fulfill({ json: [
      { selectionId: 17, workflowTypeStateTransitionId: 17, workflowTypeStateId: 31,
        nodeNumber: 2, stateId: 21, stateName: 'Review', isDefault: true },
    ] }));
    await page.goto('/workflowinboxpage');
    await page.getByRole('row', { name: /Fixture object/ }).click();
    await page.getByRole('button', { name: 'Workflow history', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Workflow history' });
    await expectWithinViewport(history, viewport, true);
    await expectWithinViewport(history.getByRole('button', { name: 'Refresh' }), viewport);
    await expectWithinViewport(history.getByRole('table').locator('..'), viewport);
    await history.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    const transition = page.getByRole('dialog', { name: 'Next' });
    await expect(transition.getByRole('combobox', { name: 'State' })).toHaveValue('17');
    await expectWithinViewport(transition, viewport, true);
    await expectWithinViewport(transition.getByRole('button', { name: 'Save' }), viewport);
    await expectNoPageOverflow(page, viewport.width);
  });
}

test('uses the Workflow owner destination for Complete and Cancel and hides unsupported Open targets', async ({ page }) => {
  await mockApi(page, { ownerPages: true });
  await page.route('**/api/workflow/getworkflowinbox', route => route.fulfill({ json: [
    { ...workflowInboxRow, canRestart: false, isInitialState: true,
      workPageUrl: '/unmigrated-work-page' },
  ] }));
  await page.route('**/api/workflow/getnextstates?*', route => {
    const action = Number(new URL(route.request().url()).searchParams.get('workflowAction'));
    expect([3, 4]).toContain(action);
    return route.fulfill({ json: [{ selectionId: action + 60, workflowTypeStateTransitionId: action + 60,
      workflowTypeStateId: action + 30, nodeNumber: 2, stateId: action + 100,
      stateName: action === 3 ? 'Configured cancellation' : 'Configured completion', isDefault: true }] });
  });
  await page.route('**/api/workflow/changeworkflowstate', route => {
    const request = route.request();
    expect(request.headers()['x-dcp-csrf']).toBe('fixture-session');
    const body = request.postDataJSON();
    expect(body).toMatchObject({ workflowObjectId: '9007199254740993', currentWorkflowObjectTransitionId: '9007199254740994',
      newStateId: body.workflowAction + 100, newWorkflowTypeStateId: body.workflowAction + 30,
      workflowTypeStateTransitionId: body.workflowAction + 60, nodeNumber: 2 });
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/workflowinboxpage');
  for (const label of ['Complete', 'Cancel']) {
    await page.getByRole('row', { name: /Fixture object/ }).click();
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: label, exact: true }).click();
    const transition = page.getByRole('dialog', { name: label, exact: true });
    await expect(transition.getByRole('combobox', { name: 'State' })).toHaveValue(label === 'Complete' ? '64' : '63');
    const saved = page.waitForResponse('**/api/workflow/changeworkflowstate');
    await transition.getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBe(true);
    await expect(transition).not.toBeVisible();
  }
});

test('uploads selected documents separately and preserves exact document IDs', async ({ page }) => {
  await mockApi(page);
  let lists = 0;
  const files: string[] = [];
  await page.route('**/api/document/getobjectdocuments?*', route => {
    lists++;
    return route.fulfill({ contentType: 'application/json', body: '[{"documentId":9007199254740993,"documentName":"Fixture.png",' +
      '"documentFileTypeName":"PNG","documentTypeName":"Attachment","description":"Fixture metadata","isDeleted":false}]' });
  });
  await page.route('**/api/document/uploadobjectdocuments', route => {
    const request = route.request();
    expect(request.headers()['x-dcp-csrf']).toBe('fixture-session');
    const file = /filename="([^"]+)"/.exec(request.postData() ?? '')?.[1] ?? '';
    files.push(file);
    return route.fulfill({ json: { success: file === 'first.txt' } });
  });
  await page.goto('/userlistpage');
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit user' }).getByRole('button', { name: 'Documents' }).click();
  const documents = page.getByRole('dialog', { name: 'Documents' });
  await expect(documents.getByRole('cell', { name: '9007199254740993' })).toBeVisible();
  await expect(documents.getByRole('cell', { name: 'Fixture metadata' })).toBeVisible();
  const downloaded = page.waitForRequest('**/api/document/downloadobjectdocument?*');
  await documents.getByRole('button', { name: 'Preview' }).click();
  expect(new URL((await downloaded).url()).searchParams.get('documentObjectId')).toBe('9007199254740993');
  await page.getByRole('dialog', { name: 'Fixture.png' }).getByRole('button', { name: 'Close' }).click();
  await documents.locator('input[type="file"]').setInputFiles([
    { name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
    { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
    { name: 'unexpected.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('unsupported') },
  ]);
  await expect(documents.getByRole('listitem')).toHaveCount(3);
  await expect(documents.getByRole('listitem').filter({ hasText: 'first.txt' })).toContainText('Changes saved.');
  await expect(documents.getByRole('listitem').filter({ hasText: 'unexpected.exe' })).toContainText('supported file');
  expect(files).toEqual(['first.txt', 'second.txt']);
  await expect.poll(() => lists).toBe(2);
  await documents.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => lists).toBe(3);
});

for (const viewport of responsiveSizes) {
  test(`previews an octet-stream text attachment on ${viewport.name}`, async ({ page }) => {
    const text = 'Türkçe metin\n<img src=x onerror=alert(1)>\n' + 'A'.repeat(512) + '\n'.repeat(50) + 'Last line';
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.route('**/api/document/getobjectdocuments?*', route => route.fulfill({ json: [
      { documentId: '42', documentName: 'Fixture.TXT', isDeleted: false },
    ] }));
    await page.route('**/api/document/downloadobjectdocument?*', route => route.fulfill({
      contentType: 'application/octet-stream', headers: { 'content-disposition': 'attachment; filename="Fixture.TXT"' }, body: text,
    }));
    await page.goto('/userlistpage');
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit user' }).getByRole('button', { name: 'Documents' }).click();
    const documents = page.getByRole('dialog', { name: 'Documents' });
    await documents.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByRole('dialog', { name: 'Fixture.TXT' });
    const body = preview.locator('.workspace-popup-body');
    await expect.poll(() => body.locator('pre').textContent()).toBe(text);
    await expect(preview.locator('img')).toHaveCount(0);
    await expectWithinViewport(preview, viewport, true);
    await expectNoPageOverflow(page, viewport.width);
    expect(await body.evaluate(element => element.scrollWidth)).toBe(await body.evaluate(element => element.clientWidth));
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const close = preview.getByRole('button', { name: 'Close' });
    await expectWithinViewport(close, viewport, true);
    await close.click();
    await expect(documents).toBeVisible();
  });
}

test('localizes Turkish management menus and the Workflow workgroup column', async ({ page }) => {
  await mockApi(page, { ownerPages: true });
  await page.route('**/api/session', route => route.fulfill({ json: { ...signedIn, language: 'tr-TR' } }));
  await page.route('**/api/userservice/getuserpreferencesweb?*', route => route.fulfill({ json: { ...preferences, language: 'tr-TR' } }));
  await page.route('**/api/userservice/getuseraccessibleelements', route => route.fulfill({ json: [
    ...elements,
    node(120, 10, 'NotificationWebUI', 'WebUIModule', false, 'Notification Management'),
    node(121, 120, 'WebNotificationList', 'WebForm', true),
    node(122, 10, 'WebWorkflowInbox', 'WebForm', true),
  ] }));
  await page.goto('/workflowinboxpage');
  const nav = page.getByRole('navigation', { name: 'Çalışma alanı' });
  await nav.locator('summary').filter({ hasText: 'Yapılandırma Yönetimi' }).click();
  await expect(nav.getByRole('link', { name: 'Müşteri Yönetimi' })).toBeVisible();
  await nav.locator('summary').filter({ hasText: 'Uyarı Yönetimi' }).click();
  await expect(nav.getByRole('link', { name: 'Uyarılar' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Çalışma Grubu', exact: true })).toBeVisible();
});

test('opens a configured cache value through the Cache owner', async ({ page }) => {
  await mockApi(page, { customerId: 0, ownerPages: true });
  await page.goto('/cacheitemlistformpage');
  await page.getByRole('button', { name: 'FixtureCacheKey' }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Fixture value', { exact: false })).toBeVisible();
});

test('keeps a valid browser session when an owning service returns 401', async ({ page }) => {
  await mockApi(page, { customerId: 0, ownerPages: true });
  await page.route('**/api/servicemanagement/getservicelist', route => route.fulfill({ status: 401, json: {} }));
  let ownerRejected = false;
  const revalidated = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/session' && response.ok() && ownerRejected);
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/servicemanagement/getservicelist' && response.status() === 401)
      ownerRejected = true;
  });
  await page.goto('/servicedashboard');
  await revalidated;
  await expect(page.getByText('The request could not be completed.')).toBeVisible();
  await expect(page).toHaveURL(/\/servicedashboard$/);
  await expect(page.getByRole('heading', { name: 'Service dashboard', level: 1 })).toBeVisible();
});

test('sends a named SQL connection to the Report owner and displays the result', async ({ page }) => {
  await mockApi(page, { customerId: 0, ownerPages: true });
  await page.goto('/sqlclient');
  await page.getByRole('textbox', { name: 'SQL statement' }).fill('SELECT 1');
  const response = page.waitForResponse(item => item.url().endsWith('/report/executesqlcommand'));
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  expect((await response).request().postDataJSON()).toEqual({
    connectionKey: 'FixtureReportReadOnly', commandText: 'SELECT 1',
  });
  await expect(page.getByRole('cell', { name: 'Fixture result' })).toBeVisible();
});

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

test('keeps page and grid scrolling separate with a 15 px scrollbar at 320 px', async ({ baseURL, channel }) => {
  const browser = await chromium.launch({ channel, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 320, height: 640 } });
    await mockApi(page);
    await page.goto('/userlistpage');
    await expect(page.getByRole('heading', { name: 'Users List' })).toBeVisible();
    await page.addStyleTag({ content: 'html { overflow-y: scroll } html::-webkit-scrollbar { width: 15px }' });

    const availableWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(availableWidth).toBe(305);
    await expectNoPageOverflow(page, availableWidth);

    const grid = page.locator('.workspace-table');
    await expect(grid.getByRole('row')).toHaveCount(2);
    await expectWithinViewport(grid, { width: availableWidth, height: 640 });
    await grid.press('ArrowRight');
    await expect.poll(() => grid.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expectNoPageOverflow(page, availableWidth);
  } finally {
    await browser.close();
  }
});

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
      await navigation.locator('summary').first().click();
      await navigation.locator('summary[aria-label="Configuration Management"]').click();
      await expectWithinViewport(navigation.getByRole('link', { name: 'Customer Management' }), viewport, true);
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
    await expect(editor.locator('input[name="userName"]')).toBeFocused();
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
    for (const label of ['Roles', 'Access Models']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled();
    }
    await page.getByRole('button', { name: '8', exact: true }).click();
    for (const label of ['Roles', 'Access Models']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      const related = page.getByRole('dialog', { name: 'Grace Hopper - ' + label });
      await expectWithinViewport(related, viewport, true);
      const grid = related.getByRole('table', { name: label, exact: true });
      await expectWithinViewport(grid.locator('..'), viewport);
      if (label === 'Roles') await expect(grid.getByRole('cell', { name: 'Operations' })).toBeVisible();
      else {
        await grid.getByRole('button', { name: 'Security', exact: true }).click();
        await expect(grid.getByRole('cell', { name: 'Directory', exact: true })).toBeVisible();
      }
      const closeRelated = related.getByRole('button', { name: 'Close', exact: true });
      await expectWithinViewport(closeRelated, viewport, true);
      await closeRelated.click();
      await expect(page.getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
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

  test(`opens scoped role and workgroup dialogs on ${viewport.name}`, async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize(viewport);
    for (const [path, id, name] of [
      ['/rolelistpage', '9', 'Operations'], ['/workgrouptreelistpage', '10', 'Main Office'],
    ]) {
      await page.goto(path);
      if (id === '10') {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.getByRole('cell', { name: 'Operations Team' })).toBeVisible();
      }
      await page.getByRole('button', { name: id, exact: true }).click();
      await page.getByRole('button', { name: 'View', exact: true }).click();
      const detail = page.getByRole('dialog', { name, exact: true });
      await expectWithinViewport(detail, viewport, true);
      await expect(detail.getByText(id === '9' ? 'operations' : 'main-office', { exact: true })).toBeVisible();
      await expectWithinViewport(detail.getByRole('button', { name: 'Close', exact: true }), viewport, true);
      await detail.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const editor = page.getByRole('dialog', { name: id === '9' ? 'Edit Role' : 'Edit Workgroup', exact: true });
      await expectWithinViewport(editor, viewport, true);
      await expect(editor.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name);
      const editorClose = editor.getByRole('button', { name: 'Close', exact: true }).first();
      await expectWithinViewport(editorClose, viewport, true);
      await editorClose.click();
      for (const label of ['Users', 'Access Models']) {
        await page.getByRole('button', { name: label, exact: true }).click();
        const related = page.getByRole('dialog', { name: name + ' - ' + label });
        await expectWithinViewport(related, viewport, true);
        const grid = related.getByRole('table', { name: label, exact: true });
        await expectWithinViewport(grid.locator('..'), viewport);
        await expect(grid.getByRole('cell', { name: label === 'Users' ? 'Grace Hopper' : 'Security' })).toBeVisible();
        if (label === 'Users') {
          await related.getByRole('button', { name: '41', exact: true }).click();
          await related.getByRole('button', { name: 'Edit', exact: true }).click();
          const memberEditor = page.getByRole('dialog', { name: id === '9' ? 'Edit Role membership' : 'Edit Workgroup membership' });
          await expectWithinViewport(memberEditor, viewport, true);
          await expect(memberEditor.getByRole('combobox', { name: 'User', exact: true })).toHaveValue('8');
          const memberClose = memberEditor.getByRole('button', { name: 'Close', exact: true }).first();
          await expectWithinViewport(memberClose, viewport, true);
          await memberClose.click();
        }
        await related.getByRole('button', { name: 'Close', exact: true }).click();
      }
      await expectNoPageOverflow(page, viewport.width);
    }
    for (const [url, label] of [
      ['/userroleslistpage?userId=8', 'Roles'],
      ['/roleuserslistpage?roleId=9', 'Users'],
      ['/workgroupuserslistpage?workgroupId=10', 'Users'],
      ['/accessmodeltreelistpage?userId=8', 'Access Models'],
    ]) {
      await page.goto(url);
      const grid = page.getByRole('table', { name: label, exact: true });
      await expectWithinViewport(grid.locator('..'), viewport);
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test(`opens Customer and Licence lists on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { customerId: 0 });
    await page.setViewportSize(viewport);
    await page.goto('/customerlistpage');
    const customers = page.getByRole('table', { name: 'Customers', exact: true });
    await expect(customers.getByText('Acme', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('1');
    await page.getByRole('button', { name: /search/i }).click();
    await expect(customers.getByText('Acme', { exact: true })).toBeVisible();
    await expect(customers.getByText('Example Institute')).toHaveCount(0);
    await expectWithinViewport(customers.locator('..'), viewport);
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'Licences', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Acme - Licences' });
    await expectWithinViewport(dialog, viewport, true);
    await expect(dialog.getByText('Core Annual', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '81', exact: true }).click();
    await dialog.getByRole('button', { name: 'View', exact: true }).click();
    const customerLicence = page.getByRole('dialog', { name: 'Core Annual', exact: true });
    await expectWithinViewport(customerLicence, viewport, true);
    await expect(customerLicence.getByText('50', { exact: true })).toBeVisible();
    await customerLicence.getByRole('button', { name: 'Close', exact: true }).click();
    await expectWithinViewport(dialog.getByRole('button', { name: 'Close', exact: true }), viewport, true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expectNoPageOverflow(page, viewport.width);
    for (const route of ['/licencelistpage', '/customerlicencelistpage?customerId=1']) {
      await page.goto(route);
      const licences = page.getByRole('table', { name: 'Licences', exact: true });
      await expect(licences.getByText('Core Annual', { exact: true })).toBeVisible();
      await expectWithinViewport(licences.locator('..'), viewport);
      await licences.getByRole('button', { name: route === '/licencelistpage' ? '3' : '81', exact: true }).click();
      await page.getByRole('button', { name: 'View', exact: true }).click();
      const licence = page.getByRole('dialog', { name: 'Core Annual', exact: true });
      await expectWithinViewport(licence, viewport, true);
      if (route === '/licencelistpage') {
        await expect(licence.getByRole('cell', { name: 'Core', exact: true })).toBeVisible();
      } else {
        await expect(licence.getByText('50', { exact: true })).toBeVisible();
      }
      await licence.getByRole('button', { name: 'Close', exact: true }).click();
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test(`opens the individual Access Model dialog on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { accessModelDialog: true, excludedGrants: ['WebSaveAccessModels'] });
    await page.setViewportSize(viewport);
    await page.goto('/accessmodeltreelistpage?userId=8');
    const grid = page.getByRole('table', { name: 'Access Models', exact: true });
    await grid.getByRole('button', { name: 'Security', exact: true }).click();
    await grid.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'View', exact: true }).click();
    const view = page.getByRole('dialog', { name: 'Directory', exact: true });
    await expectWithinViewport(view, viewport, true);
    await expect(view.getByRole('checkbox', { name: 'Active', exact: true })).toBeDisabled();
    await expectWithinViewport(view.getByRole('button', { name: 'Close', exact: true }).first(), viewport, true);
    await view.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Edit selected grant' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Directory', exact: true });
    await expectWithinViewport(edit, viewport, true);
    await edit.getByRole('checkbox', { name: 'Active', exact: true }).uncheck();
    const sent = page.waitForRequest(request => request.url().endsWith('/savewebaccessmodels?single=true'));
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await sent).postDataJSON()).toEqual({ scope: { userId: 8 }, changes: [{
      elementId: 2, grantId: 102, expectedAccessRight: 1, expectedIsActive: true, expectedIsDeleted: false, isActive: false, isDeleted: false,
    }] });
    await expect(edit).toHaveCount(0);
    await expectNoPageOverflow(page, viewport.width);
  });

  test(`opens Licence maintenance on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { customerId: 0, licenceMaintenance: true });
    await page.setViewportSize(viewport);
    await page.goto('/licencelistpage');
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Licence', exact: true });
    await expect(editor.getByRole('textbox', { name: 'Licence', exact: true })).toHaveValue('Core Annual');
    await expectWithinViewport(editor, viewport, true);
    await expectWithinViewport(editor.getByRole('button', { name: 'Save', exact: true }), viewport, true);
    const grid = editor.getByRole('table', { name: 'Applications', exact: true });
    await grid.scrollIntoViewIfNeeded();
    await expectWithinViewport(grid.locator('..'), viewport);
    await editor.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expectNoPageOverflow(page, viewport.width);
  });

  test(`opens the scoped Customer Licence editor on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { customerId: 0, customerLicenceMaintenance: true });
    await page.setViewportSize(viewport);
    await page.goto('/customerlistpage');
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'Licences', exact: true }).click();
    const list = page.getByRole('dialog', { name: 'Acme - Licences' });
    await list.getByRole('button', { name: '81', exact: true }).click();
    await list.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Customer Licence', exact: true });
    await expect(editor.getByRole('spinbutton', { name: 'User Count', exact: true })).toHaveValue('50');
    await expectWithinViewport(editor, viewport, true);
    await expectWithinViewport(editor.getByRole('button', { name: 'Save', exact: true }), viewport, true);
    await editor.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(list).toBeVisible();
    await list.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expectNoPageOverflow(page, viewport.width);
  });

  test(`opens Asset routes and edit dialog on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { assetManagement: true });
    await page.setViewportSize(viewport);
    await page.goto('/assetlistpage');
    const grid = page.getByRole('table', { name: 'Assets', exact: true });
    await grid.getByRole('button', { name: '9007199254740993', exact: true }).click();
    await expectWithinViewport(grid.locator('..'), viewport);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Asset', exact: true });
    await expect(editor.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Laptop');
    await expectWithinViewport(editor, viewport, true);
    await expectWithinViewport(editor.getByRole('button', { name: 'Save', exact: true }), viewport, true);
    await editor.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expectNoPageOverflow(page, viewport.width);
    await page.goto('/assetdashboard');
    await expect(page.getByRole('heading', { name: 'Asset Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('meter', { name: 'Equipment' })).toBeVisible();
    const dates = page.waitForRequest(request => request.url().includes('/getassettypescount?'));
    await page.getByRole('combobox', { name: 'Date Range' }).selectOption('Month');
    const query = new URL((await dates).url()).searchParams;
    expect(query.get('localStartDate')).toMatch(/^\d{4}-\d{2}-01$/);
    expect(query.get('localEndDate')).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/);
    await expectNoPageOverflow(page, viewport.width);
  });

  test(`opens Event definitions and dashboard on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { customerId: 0, eventManagement: true });
    await page.setViewportSize(viewport);
    await page.goto('/eventlistpage');
    const grid = page.getByRole('table', { name: 'Events', exact: true });
    await grid.getByRole('button', { name: '46', exact: true }).click();
    await expectWithinViewport(grid.locator('..'), viewport);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Event', exact: true });
    await expect(editor.getByRole('combobox', { name: 'Severity', exact: true })).toHaveValue('Information');
    await expectWithinViewport(editor, viewport, true);
    await expectWithinViewport(editor.getByRole('button', { name: 'Save', exact: true }), viewport, true);
    await editor.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expectNoPageOverflow(page, viewport.width);
    await page.goto('/eventdashboard');
    await expect(page.getByRole('meter', { name: 'Login' })).toBeVisible();
    const dates = page.waitForRequest(request => request.url().includes('/getwebeventdashboard?'));
    await page.getByRole('combobox', { name: 'Date Range' }).selectOption('Today');
    const query = new URL((await dates).url()).searchParams;
    expect(query.get('localStartDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.get('localEndDate')).toBe(query.get('localStartDate'));
    await expectNoPageOverflow(page, viewport.width);
  });

  test(`maintains existing Customers on ${viewport.name}`, async ({ page }) => {
    await mockApi(page, { customerId: 0, customerMaintenance: true });
    await page.setViewportSize(viewport);
    await page.goto('/customerlistpage');
    const grid = page.getByRole('table', { name: 'Customers', exact: true });
    await grid.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'View', exact: true }).click();
    const view = page.getByRole('dialog', { name: 'Example Institute', exact: true });
    await expectWithinViewport(view, viewport, true);
    await expect(view.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('readonly', '');
    await view.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Example Institute', exact: true });
    await expectWithinViewport(editor, viewport, true);
    await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Updated Institute');
    await expectWithinViewport(editor.getByRole('button', { name: 'Save', exact: true }), viewport, true);
    const save = page.waitForRequest(request => request.url().endsWith('/savecustomer'));
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await save).postDataJSON()).toMatchObject({ id: 2, customerName: 'Updated Institute', cityId: 2 });
    await expect(grid.getByRole('cell', { name: 'Updated Institute' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await expectWithinViewport(confirmation, viewport, true);
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(grid.getByRole('cell', { name: 'Updated Institute' })).toHaveCount(0);
    await expectNoPageOverflow(page, viewport.width);
  });
}

test('maintains an Event definition with its named severity and process manager', async ({ page }) => {
  await mockApi(page, { customerId: 0, eventManagement: true });
  await page.goto('/eventlistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'New Event', exact: true });
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Session audited');
  await editor.getByRole('textbox', { name: 'Key Name', exact: true }).fill('SessionAudited');
  await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('1');
  await editor.getByRole('combobox', { name: 'Severity', exact: true }).selectOption('High');
  await editor.getByRole('combobox', { name: 'Process Manager', exact: true }).selectOption('MultipleQueue');
  const created = page.waitForRequest('**/api/event/saveevent');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await created).postDataJSON()).toMatchObject({ id: 0, severityId: 'High', processManagerKeyName: 'MultipleQueue' });
  await page.getByRole('button', { name: '47', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: '47', exact: true })).toHaveCount(0);
});

test('maintains assets with exact 64-bit identifiers and validates JSON content', async ({ page }) => {
  await mockApi(page, { assetManagement: true });
  await page.goto('/assetlistpage');
  await page.getByRole('button', { name: '9007199254740993', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Asset', exact: true });
  const content = editor.getByRole('textbox', { name: 'Content', exact: true });
  await content.fill('{');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByText('Enter valid JSON.')).toBeVisible();
  await content.fill('{"serial":"XYZ"}');
  const update = page.waitForRequest('**/assetservice/saveasset');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await update).postDataJSON()).toMatchObject({ id: '9007199254740993', features: '{"serial":"XYZ"}' });
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'New Asset', exact: true });
  await creation.getByRole('textbox', { name: 'Name', exact: true }).fill('Projector');
  await creation.getByRole('textbox', { name: 'Identifier', exact: true }).fill('A-002');
  await creation.getByRole('combobox', { name: 'Type', exact: true }).selectOption('1');
  await creation.getByRole('button', { name: 'Save', exact: true }).click();
  const created = page.getByRole('button', { name: '9007199254740995', exact: true });
  await created.click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const removal = page.waitForRequest('**/assetservice/deleteasset?assetId=9007199254740995');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await removal;
  await expect(created).toHaveCount(0);
});

test('maintains Customer Licences with parent scope and preserves unchanged date offsets', async ({ page }) => {
  await mockApi(page, { customerId: 0, customerLicenceMaintenance: true });
  await page.goto('/customerlicencelistpage?customerId=1');
  await page.getByRole('button', { name: '81', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Customer Licence', exact: true });
  await editor.getByRole('spinbutton', { name: 'User Count', exact: true }).fill('55');
  const request = page.waitForRequest('**/savecustomerlicence?customerId=1');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ id: 81, customerId: 1, maxUserCount: 55,
    useEditorDateOffsets: true, startDateWithOffset: '2025-01-01T08:30:32.123456+00:00', endDateWithOffset: '2099-01-01T17:45:00+00:00' });
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'New Customer Licence', exact: true });
  await creation.getByRole('combobox', { name: 'Type', exact: true }).selectOption('1');
  await creation.getByRole('combobox', { name: 'Licence', exact: true }).selectOption('3');
  await creation.getByLabel('Start Date', { exact: true }).fill('2099-02-01');
  await creation.getByLabel('End Date', { exact: true }).fill('2099-02-02');
  await creation.getByRole('spinbutton', { name: 'User Count', exact: true }).fill('5');
  const added = page.waitForRequest('**/savecustomerlicence?customerId=1');
  await creation.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await added).postDataJSON()).toMatchObject({ id: 0, customerId: 1, startDateWithOffset: '2099-02-01T00:00:00.000Z' });
  await page.getByRole('button', { name: '82', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const removed = page.waitForRequest('**/deletecustomerlicence?customerId=1&customerLicenceId=82');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await removed;
  await expect(page.getByRole('button', { name: '82', exact: true })).toHaveCount(0);
});

test('creates a Licence before assigning applications and sends only changed rows', async ({ page }) => {
  await mockApi(page, { customerId: 0, licenceMaintenance: true, saveAndClose: false });
  await page.goto('/licencelistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const newEditor = page.getByRole('dialog', { name: 'New Licence', exact: true });
  await expect(newEditor.getByRole('button', { name: 'Add application' })).toBeDisabled();
  await newEditor.getByRole('textbox', { name: 'Licence', exact: true }).fill('Test Licence');
  await newEditor.getByRole('spinbutton', { name: 'Additional Period (Days)' }).fill('7');
  const creation = page.waitForRequest('**/api/customerservice/savelicence');
  await newEditor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await creation).postDataJSON()).toMatchObject({ id: 0, licenceApplications: [] });
  const editor = page.getByRole('dialog', { name: 'Edit Licence', exact: true });
  await editor.getByRole('button', { name: 'Add application' }).click();
  await editor.getByRole('combobox', { name: 'Application' }).selectOption('10');
  const first = page.waitForRequest('**/api/customerservice/savelicence');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await first).postDataJSON()).toMatchObject({ id: 4, licenceApplications: [{ id: 0, licenceId: 4, applicationId: 10 }] });
  await expect(editor.getByRole('cell', { name: '22', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Add application' }).click();
  const draft = editor.getByRole('combobox', { name: 'Application' }).last();
  await draft.selectOption('10');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByText('This application is already assigned.')).toBeVisible();
  await draft.selectOption('11');
  const second = page.waitForRequest('**/api/customerservice/savelicence');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await second).postDataJSON().licenceApplications).toEqual([
    { id: 0, licenceId: 4, applicationId: 11, isActive: true, isDeleted: false },
  ]);
  await expect(editor.getByRole('cell', { name: '23', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Test Licence' })).toHaveCount(0);
});

test('tenant Customer list omits common administration', async ({ page }) => {
  await mockApi(page);
  await page.goto('/customerlistpage');
  await expect(page.getByRole('cell', { name: 'Acme', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Example Institute' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Licences', exact: true })).toHaveCount(0);
  const requests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/getcustomerlicences')) requests.push(request.url());
  });
  await page.goto('/customerlicencelistpage?customerId=1');
  await expect(page.getByRole('alert')).toHaveText('Access denied');
  expect(requests).toEqual([]);
});

test('exports only the customers returned for the signed-in tenant', async ({ page }) => {
  await mockApi(page);
  await page.goto('/customerlistpage');
  await expect(page.getByRole('cell', { name: 'Acme', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('customers.csv');
  const csv = await readFile(await file.path(), 'utf8');
  expect(csv).toContain('"Acme"');
  expect(csv).not.toContain('Example Institute');
});

for (const viewport of responsiveSizes) test(`creates a customer and retries pending administrator setup on ${viewport.name}`, async ({ page }) => {
  await mockApi(page, { customerId: 0, customerMaintenance: true });
  await page.setViewportSize(viewport);
  const created = { id: 17, customerName: 'New Institute', customerTypeName: 'Education' };
  let saved = false;
  let complete = false;
  await page.route('**/api/customerservice/getcustomers', route => route.fulfill({ json: saved ? [created] : [] }));
  await page.route('**/api/customerservice/savecustomer', route => {
    const request = route.request();
    expect(request.headers()['x-dcp-csrf']).toBe('fixture-session');
    expect(request.postDataJSON()).toMatchObject({ id: 0, customerName: 'New Institute', supportEmail: 'admin@institute.test' });
    expect(request.postDataJSON()).not.toHaveProperty('documentStoreId');
    saved = true;
    return route.fulfill({ status: 202, json: { success: true, data: 17 } });
  });
  await page.route('**/api/customerservice/getwebcustomeradministratorsetup?customerId=17', route =>
    route.fulfill({ json: { complete, canRetry: !complete } }));
  await page.route('**/api/customerservice/retrywebcustomeradministratorsetup?customerId=17', route => {
    expect(route.request().method()).toBe('POST');
    complete = true;
    return route.fulfill({ status: 202, json: { success: true } });
  });
  await page.goto('/customerlistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expectWithinViewport(editor, viewport, true);
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('New Institute');
  await editor.getByRole('textbox', { name: 'Key Name', exact: true }).fill('new-institute');
  await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('2');
  await editor.getByRole('textbox', { name: 'Support Email', exact: true }).fill('admin@institute.test');
  await editor.getByRole('textbox', { name: 'Info Email', exact: true }).fill('info@institute.test');
  await editor.getByRole('textbox', { name: 'Phone', exact: true }).fill('5550123456');
  await editor.getByRole('combobox', { name: 'Country', exact: true }).selectOption('1');
  await editor.getByRole('combobox', { name: 'City', exact: true }).selectOption('2');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: '17', exact: true }).click();
  await page.getByRole('button', { name: 'Administrator setup', exact: true }).click();
  await expectWithinViewport(editor, viewport, true);
  await expect(editor.getByRole('status')).toHaveText('The first administrator has not been provisioned yet.');
  await editor.getByRole('button', { name: 'Retry setup', exact: true }).click();
  await expect(editor.getByRole('status')).toHaveText('The first administrator has been provisioned.');
  await expect(editor.getByRole('button', { name: 'Retry setup', exact: true })).toHaveCount(0);
});

for (const viewport of responsiveSizes) test(`resolves equivalent Access Model grants after confirmation on ${viewport.name}`, async ({ page }) => {
  await mockApi(page, { accessModelDialog: true });
  await page.setViewportSize(viewport);
  let resolved = false;
  await page.route('**/api/accessservice/getaccessmodels', route => route.fulfill({ json: [{
    id: 1, accessModelId: resolved ? 101 : 0, parentConfigurationElementId: 0, elementName: 'Equivalent grants',
    checked: true, isActive: true, isDeleted: false, accessRight: 'Execute', hasMultipleGrants: !resolved,
    equivalentGrantIds: resolved ? null : [101, 102],
  }] }));
  await page.route('**/api/accessservice/savewebaccessmodels', route => {
    expect(route.request().postDataJSON()).toEqual({
      scope: { userId: 8 }, changes: [{ elementId: 1, grantId: 101, expectedAccessRight: 1, expectedIsActive: true,
        expectedIsDeleted: false, isActive: true, isDeleted: false }], equivalentGrantIds: [101, 102],
    });
    resolved = true;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/accessmodeltreelistpage?userId=8');
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Resolve duplicate grants', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expectWithinViewport(confirm, viewport, true);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(resolved).toBe(false);
  await page.getByRole('button', { name: 'Resolve duplicate grants', exact: true }).click();
  await confirm.getByRole('button', { name: 'Resolve duplicate grants', exact: true }).click();
  await expect(page.getByText('Equivalent grants', { exact: true })).toBeVisible();
  expect(resolved).toBe(true);
});

for (const viewport of responsiveSizes) test(`edits the selected conflicting grant on ${viewport.name}`, async ({ page }) => {
  await mockApi(page, { accessModelDialog: true });
  await page.setViewportSize(viewport);
  let active = true;
  await page.route('**/api/accessservice/getaccessmodels', route => route.fulfill({ json: [{
    id: 1, accessModelId: 0, parentConfigurationElementId: 0, elementName: 'Conflicting grants',
    checked: true, isActive: true, isDeleted: false, accessRight: 'None', hasMultipleGrants: true,
    grantChoices: [{ id: 101, accessRight: 1, isActive: active, isDeleted: false },
      { id: 102, accessRight: 2, isActive: true, isDeleted: false }],
  }] }));
  await page.route('**/api/accessservice/getaccessmodel?*', route => {
    expect(Object.fromEntries(new URL(route.request().url()).searchParams))
      .toEqual({ userId: '8', elementId: '1', accessModelId: '101' });
    return route.fulfill({ json: { id: 101, isActive: active, isDeleted: false } });
  });
  await page.route('**/api/accessservice/savewebaccessmodels?single=true', route => {
    expect(route.request().postDataJSON()).toEqual({
      scope: { userId: 8 }, changes: [{ elementId: 1, grantId: 101, expectedAccessRight: 1, expectedIsActive: true,
        expectedIsDeleted: false, isActive: false, isDeleted: false }],
    });
    active = false;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/accessmodeltreelistpage?userId=8');
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Grant', exact: true }).selectOption('101');
  await page.getByRole('button', { name: 'Edit selected grant', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expectWithinViewport(editor, viewport, true);
  await editor.getByRole('checkbox', { name: 'Active', exact: true }).uncheck();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(active).toBe(false);
});

test('exports the full filtered Event Records result across API pages', async ({ page }) => {
  await mockApi(page, { eventManagement: true });
  const events = Array.from({ length: 201 }, (_, index) => ({
    eventKey: String(index + 1), eventDate: date, eventType: 'Fixture event ' + (index + 1),
  }));
  const queries: Array<{ page: number; pageSize: number; localStartDate: string; localEndDate: string }> = [];
  await page.route('**/api/event/getwebeventsearchchoices', route => route.fulfill({ json: { roots: [], groups: [], types: [] } }));
  await page.route('**/api/event/querywebeventrecords', route => {
    const query = route.request().postDataJSON();
    queries.push(query);
    const offset = (query.page - 1) * query.pageSize;
    return route.fulfill({ json: { data: events.slice(offset, offset + query.pageSize), totalRecords: events.length } });
  });
  await page.goto('/eventobjectlist');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Fixture event 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export all results', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('event-records.csv');
  const csv = await readFile(await file.path(), 'utf8');
  expect(csv.split('\r\n')).toHaveLength(202);
  expect(csv).toContain('"Fixture event 201"');
  const { localStartDate, localEndDate } = queries[0];
  expect(queries.slice(1)).toEqual([
    { page: 1, pageSize: 200, localStartDate, localEndDate },
    { page: 2, pageSize: 200, localStartDate, localEndDate },
  ]);
});

test('confirms and deletes a Configuration version under the selected element', async ({ page }) => {
  await mockApi(page, { customerId: 0, configurationVersions: true });
  const element = { id: 17, elementName: 'Fixture setting', typeId: 1, isActive: true, isSystemElement: false };
  const version = { id: 81, customerId: 0, configurationElementTypeSchemaVersionId: 2, version: '1.2.3',
    versionDate: date, installedDate: date, objectTypeId: 0, objectId: '0', isActive: true };
  let deleted = false;
  await page.route('**/api/configuration/getwebconfigurationelementchoices?*', route =>
    route.fulfill({ json: { types: [], licenceTypes: [] } }));
  await page.route('**/api/configuration/getwebconfigurationelements?*', route => route.fulfill({ json: [element] }));
  await page.route('**/api/configuration/getwebconfigurationelementversionmetadata?*', route =>
    route.fulfill({ json: deleted ? [] : [version] }));
  await page.route('**/api/configuration/deletewebconfigurationelementversion?*', route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.headers()['x-dcp-csrf']).toBe('fixture-session');
    expect(Object.fromEntries(new URL(request.url()).searchParams)).toEqual({
      tree: 'false', configurationElementId: '17', id: '81',
    });
    deleted = true;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/configurationelementlistpage');
  await page.getByRole('button', { name: '17', exact: true }).click();
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '81', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(deleted).toBe(false);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByRole('cell', { name: '1.2.3', exact: true })).toHaveCount(0);
  expect(deleted).toBe(true);
});

for (const viewport of responsiveSizes) test(`creates and edits Configuration versions with write-only JSON on ${viewport.name}`, async ({ page }) => {
  await mockApi(page, { customerId: 0, configurationVersions: true });
  await page.setViewportSize(viewport);
  const element = { id: 17, elementName: 'Fixture setting', typeId: 1, isActive: true, isSystemElement: false };
  const base = { customerId: 0, versionDate: date, installedDate: date, objectTypeId: 0, objectId: '0',
    isActive: true, isDeleted: false, canSave: true, canChangeScope: true,
    schemas: [{ id: 2, name: 'Schema 2' }, { id: 3, name: 'Schema 3' }],
    scopes: [{ objectTypeId: 4, key: 'Role', objects: [{ id: 77, name: 'Fixture role' }] }] };
  const updatedDate = '2026-01-11T08:00:00Z';
  let replacementSaved = false;
  let version: (typeof base & { id: number; version: string; configurationElementTypeSchemaVersionId: number; updatedDate: string }) | undefined;
  await page.route('**/api/configuration/getwebconfigurationelementchoices?*', route =>
    route.fulfill({ json: { types: [], licenceTypes: [] } }));
  await page.route('**/api/configuration/getwebconfigurationelements?*', route => route.fulfill({ json: [element] }));
  await page.route('**/api/configuration/getwebconfigurationelementversionmetadata?*', route =>
    route.fulfill({ json: version ? [version] : [] }));
  await page.route('**/api/configuration/getwebconfigurationversiondetail?*', route =>
    route.fulfill({ json: new URL(route.request().url()).searchParams.get('id') === '0'
      ? { ...base, id: 0, version: '', configurationElementTypeSchemaVersionId: 0 }
      : version }));
  await page.route('**/api/configuration/savewebconfigurationversionmetadata?*', route => {
    const request = route.request();
    const id = new URL(request.url()).searchParams.get('id');
    const body = request.postDataJSON();
    if (body.replacementContent) {
      expect(body).toEqual({ version: '1.1', versionDate: date, installedDate: date,
        expectedUpdatedDate: updatedDate, isActive: true, isDeleted: false, replacementContent: '{"enabled":true}',
        objectTypeId: 0, objectId: '0' });
      if (version) version = { ...version, objectTypeId: 0, objectId: '0' };
      replacementSaved = true;
      return route.fulfill({ json: { success: true, data: 81 } });
    }
    expect(body).toEqual({ version: id === '0' ? '1.0' : '1.1', versionDate: date, installedDate: date,
      expectedUpdatedDate: id === '0' ? null : updatedDate, isActive: true, isDeleted: false,
      schemaId: id === '0' ? 2 : 3, ...(id === '0' ? { objectTypeId: 4, objectId: '77' } : {}) });
    version = { ...base, id: 81, version: body.version, configurationElementTypeSchemaVersionId: body.schemaId, updatedDate,
      objectTypeId: 4, objectId: '77', canChangeScope: id === '0' };
    return route.fulfill({ json: { success: true, data: version.id } });
  });
  await page.goto('/configurationelementlistpage');
  await page.getByRole('button', { name: '17', exact: true }).click();
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog').last();
  await expectWithinViewport(editor, viewport, true);
  await editor.getByRole('combobox', { name: 'Schema', exact: true }).selectOption('2');
  await editor.getByRole('combobox', { name: 'Object Type', exact: true }).selectOption('4');
  await editor.getByRole('combobox', { name: 'Object', exact: true }).selectOption('77');
  await editor.getByRole('textbox', { name: 'Version', exact: true }).fill('1.0');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: '1.0', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.getByRole('combobox', { name: 'Schema', exact: true }).selectOption('3');
  await editor.getByRole('textbox', { name: 'Version', exact: true }).fill('1.1');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: '1.1', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Version', exact: true })).toHaveValue('1.1');
  await expect(editor.getByRole('combobox', { name: 'Object Type', exact: true })).toHaveCount(0);
  const replacement = editor.getByRole('textbox', { name: 'Replacement JSON (leave blank to keep the stored value)' });
  await expect(replacement).toHaveValue('');
  await replacement.fill('{"enabled":true}');
  const objectType = editor.getByRole('combobox', { name: 'Object Type', exact: true });
  await expect(objectType).toHaveValue('4');
  await objectType.selectOption('0');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(replacement).toHaveCount(0);
  expect(replacementSaved).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(replacement).toHaveValue('');
});

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
  await expect(newButton.locator('svg.lucide-plus[aria-hidden="true"]')).toHaveCSS('stroke', 'rgb(69, 33, 112)');
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

test('requires both the parent action and the destination page grant for related user actions', async ({ page }) => {
  await mockApi(page, { excludedGrants: ['WebListUserRoles', 'WebAccessModelTreeList'] });
  await page.goto('/userlistpage');
  await page.getByRole('button', { name: '8', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Roles', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Access Models', exact: true })).toHaveCount(0);
});

test('keeps direct related routes scoped and rejects a missing or ambiguous principal', async ({ page }) => {
  await mockApi(page);
  const reads: unknown[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/getaccessmodels')) reads.push(request.postDataJSON());
  });
  await page.goto('/accessmodeltreelistpage?userId=8&roleId=9');
  await expect(page.getByRole('alert')).toHaveText('Page or record not found');
  expect(reads).toEqual([]);
  await page.goto('/userroleslistpage?userId=8');
  await expect(page.getByRole('cell', { name: 'Operations' })).toBeVisible();
  await page.goto('/roleuserslistpage?roleId=9');
  await expect(page.getByRole('cell', { name: 'Grace Hopper' })).toBeVisible();
  await page.goto('/workgroupuserslistpage?workgroupId=10');
  await expect(page.getByRole('cell', { name: 'Grace Hopper' })).toBeVisible();
  await page.goto('/accessmodeltreelistpage?workgroupId=10');
  await expect(page.getByRole('table').getByRole('button', { name: 'Security', exact: true })).toBeVisible();
  expect(reads).toEqual([{ workgroupId: 10, recordStatusQueryType: 1 }]);
});

test('saves the selected user’s changed grant and refreshes the tree', async ({ page }) => {
  await mockApi(page, { duplicateAccessGrant: true });
  await page.goto('/userlistpage');
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Access Models', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Grace Hopper - Access Models' });
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByRole('button', { name: 'Security', exact: true }).click();
  await dialog.getByRole('button', { name: 'Directory', exact: true }).click();
  await expect(dialog.getByText('Duplicate action (multiple grants, read-only)')).toBeVisible();
  const duplicate = dialog.getByRole('checkbox', { name: 'Checked for Duplicate action', exact: true });
  await expect(duplicate).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Checked for Directory' }).uncheck();
  await expect(duplicate).toBeChecked();
  const request = page.waitForRequest('**/api/accessservice/savewebaccessmodels');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    scope: { userId: 8 },
    changes: [{ elementId: 2, grantId: 102, expectedAccessRight: 1,
      expectedIsActive: true, expectedIsDeleted: false, isActive: false, isDeleted: false }],
  });
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Security', exact: true }).click();
  await expect(dialog.getByRole('row', { name: /Directory/ }).getByRole('cell', { name: 'No', exact: true })).toHaveCount(3);
});

test('keeps grant edits after a stale response and guards closing the dialog', async ({ page }) => {
  await mockApi(page, { accessConflict: true });
  await page.goto('/userlistpage');
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Access Models', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Grace Hopper - Access Models' });
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByRole('button', { name: 'Security', exact: true }).click();
  const grant = dialog.getByRole('checkbox', { name: 'Checked for Directory' });
  await grant.uncheck();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('These grants changed.', { exact: false })).toBeVisible();
  await expect(grant).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue editing' }).click();
  await expect(grant).not.toBeChecked();
});

test('keeps the access tree read-only without the save grant', async ({ page }) => {
  await mockApi(page, { excludedGrants: ['WebSaveAccessModels'] });
  await page.goto('/accessmodeltreelistpage?userId=8');
  await expect(page.getByRole('table', { name: 'Access Models' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('creates, edits, and deletes a role through its authorized toolbar', async ({ page }) => {
  await mockApi(page);
  await page.goto('/rolelistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Auditors');
  await editor.getByRole('textbox', { name: 'Key Name', exact: true }).fill('auditors');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Auditors', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '91', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Reviewers');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Reviewers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '91', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Reviewers', exact: true })).toHaveCount(0);
});

test('creates, edits, and deletes a workgroup with the selected parent', async ({ page }) => {
  await mockApi(page);
  await page.goto('/workgrouptreelistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('Select a parent workgroup before adding a workgroup.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('textbox', { name: 'Parent', exact: true })).toHaveValue('Main Office');
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Customer Support');
  await editor.getByRole('textbox', { name: 'Key Name', exact: true }).fill('customer-support');
  const request = page.waitForRequest('**/api/workgroupservice/saveworkgroup');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ id: 0, parentWorkgroupId: 10, workgroupName: 'Customer Support' });
  await page.getByRole('button', { name: 'Main Office', exact: true }).click();
  await page.getByRole('button', { name: '92', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Customer Success');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Customer Success', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '92', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Customer Success', exact: true })).toHaveCount(0);
});

for (const [index, spec] of membershipFixtures.entries()) {
  test(`maintains ${spec.stem} within its parent scope and preserves membership dates`, async ({ page }) => {
    await mockApi(page);
    await page.goto(spec.route);
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: spec.field, exact: true }).selectOption(String(spec.secondOther));
    await dialog.getByLabel('Start Date (UTC)', { exact: true }).fill('2026-08-01T16:30');
    await dialog.getByLabel('End Date (UTC)', { exact: true }).fill('2026-08-03T17:45');
    if (spec.stem !== 'roleuser') await dialog.getByRole('checkbox', { name: 'Primary', exact: true }).check();
    const save = page.waitForRequest(`**/api/${spec.service}/save${spec.stem}?scopeId=${spec.parentId}`);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await save).postDataJSON()).toMatchObject({
      [spec.parentKey]: spec.parentId, [spec.otherKey]: spec.secondOther, useEditorDateOffsets: true,
      startDateWithOffset: '2026-08-01T16:30:00.000Z', endDateWithOffset: '2026-08-03T17:45:00.000Z',
      ...(spec.stem !== 'roleuser' && { isPrimary: true }),
    });
    await expect(page.getByRole('cell', { name: spec.secondName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: String(71 + index), exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dialog.getByLabel('Start Date (UTC)', { exact: true })).toHaveValue('2026-08-01T16:30');
    await dialog.getByLabel('End Date (UTC)', { exact: true }).fill('2026-08-05T18:00');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: String(71 + index), exact: true }).click();
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await expect(dialog.getByLabel('End Date (UTC)', { exact: true })).toHaveValue('2026-08-05T18:00');
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('cell', { name: spec.secondName, exact: true })).toHaveCount(0);
  });
}

test('keeps a newly saved user read-only for a creator without the edit grant', async ({ page }) => {
  const api = await mockApi(page, { excludedGrants: ['WebEditUser'], saveAndClose: false });
  await page.goto('/userlistpage');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.locator('input[name="userName"]').fill('grace');
  await editor.getByLabel('Full name').fill('Grace Hopper');
  await editor.getByLabel(/^birth date$/i).fill('1906-12-09');
  await editor.getByLabel(/^email$/i).fill('grace@example.test');
  await editor.getByLabel(/^phone$/i).fill('5550123456');
  await editor.getByRole('combobox', { name: 'Country', exact: true }).selectOption('1');
  await editor.getByRole('combobox', { name: 'City', exact: true }).selectOption('2');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor.locator('input[name="userName"]')).toBeDisabled();
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  expect(api.saves()).toBe(1);
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
