# CoreService live verification

The React development server forwarded browser requests to CoreService on port 9100. These checks used a signed-in browser session and made no changes to application records.

| Screen | Observed failure | Root cause and fix | Live retest |
| --- | --- | --- | --- |
| UserEdit | `GET /api/userservice/getuser` returned 200, and the form displayed “İstek tamamlanamadı.” | CoreService serialized `gender` as a named enum. The shared contact schema now accepts named and numeric values and normalizes them to the form’s numeric values. | UserEdit loaded its fields. My Profile also loaded with the shared schema. |
| Customer list | `POST /api/customerservice/getcustomers` returned 400. | The controller’s request context registered the Configuration entity factory only. Evaluating the browser page grant requires the Security entity factory too. The controller now registers both when hosted with Security. | Passed. The list loaded a record and its edit form loaded all fields. |
| Customer type lookup | `GET /api/customerservice/getcustomertypessimple` returned 400. The customer type selector could not load. | Same request-context dependency as the Customer list. | Passed. The selector populated three customer types and the All option. |
| Licence list | `POST /api/customerservice/getlicences` returned 400. | Same request-context dependency as the Customer list. | Passed. Three licences loaded, and the selected licence opened with its application mappings table. |
| Role → Access Models | `POST /api/accessservice/getaccessmodels` returned 400 with “Operation failed.” | Several grants matched a single role and element. The tree now shows the affected elements as read-only, and the server rejects edits to them. Unambiguous grants remain editable under the existing permissions. | Passed. The tree loaded. A duplicate row disabled editing, and an individual unambiguous grant opened with its details. |

The live User list, New User and View User dialogs, User Roles link, User Role editor, User and Workgroup Access Model trees, Role editor, and Workgroup editor loaded successfully. The Role Users and Workgroup Users lists opened with no rows for the selected records. Both New Membership dialogs loaded their fields and lookups.

The rebuilt service also returned two Customer Licence records for the selected customer. The detail dialog opened and showed the licence fields and audit information. The live retest did not submit saves or deletes. No migrations were run.

## Canonical routes on the latest local builds

React was listening on 5174 and CoreService on 9100. The React origin returned the expected HTTP 401 for a session request without a browser cookie. The VS Code embedded browser showed a signed-in workspace.

| Owning service | Local port | Affected pages | Result |
| --- | ---: | --- | --- |
| Data Management | 9500 | Service Dashboard, Cache Items, Queue List, Runtime Tables | Each initial read returned HTTP 500 through Vite. No local listener was present. |
| JSON Object | 9130 | JSON Object Management | The type lookup returned HTTP 500 through Vite. No local listener was present. |
| Agent | 9800 | Agent Dashboard | The agent list returned HTTP 500 through Vite. No local listener was present. |
| AIFramework | 9920 | AI Framework Dashboard, AI Provider Dashboard, Command Activity | Each initial read returned HTTP 500 through Vite. No local listener was present. |
| Workflow | 9120 | Workflow Inbox | The inbox read returned HTTP 500 through Vite. No local listener was present. |
| Report | 9650 | SQL Client | The connection lookup returned HTTP 500 through Vite. No local listener was present. |
| Document | 9110 | User Edit document actions | No local listener was present. |

These failures occurred before reaching the respective services. Owning-service authentication and business responses remain unverified.

### Owning service startup retest

Document (9110), Workflow (9120), JSON Object (9130), Data Management (9500), Report (9650), and AIFramework (9920) started from their existing entry points using temporary executable builds and the checked-in development settings. React and CoreService retained their running processes. A direct read against Document and read requests through Vite against the other five services returned HTTP 401 without a session. This confirms HTTP reachability. Signed-in operation results still require verification.

Agent Service (9800) stopped during startup. PostgreSQL returned `42P01` when startup tried to read `agent.agentobjects` from the configured database. Vite still returned HTTP 500 for the Agent list route. No migrations were run.

## Signed-in retest on 26 November 2026

Agent Service was excluded from this retest. The browser checks used the existing signed-in administrator session. No live saves, deletes, permission changes, or migrations were performed.

### Stage 1 — Independent services

| Pages | Signed-in result | Follow-up |
| --- | --- | --- |
| Service Dashboard, Cache Items, Queue List, Runtime Tables | Data Management returned HTTP 401 to the page's protected read. Each page displayed “İstek tamamlanamadı.” | Data Management accepts a signed bearer token and does not validate the opaque browser session cookie. |
| JSON Object Management | JSON Object returned HTTP 401 for `getjsonobjecttypessimple`. | Same authentication boundary. |
| Workflow Inbox | Workflow returned HTTP 401 for `getworkflowinbox`. | Same authentication boundary. |
| SQL Client | Report returned HTTP 401 for `connections`. No SQL was submitted. | Same authentication boundary. |
| AI Framework Dashboard, AI Provider Dashboard, Command Activity | Each route displayed “Erişim reddedildi” before calling AIFramework. | CoreService returned positive grants for the three pages and `AIFrameworkWebUI`, but omitted its parent `AIFrameworkGroupModule`. The workspace requires a complete branch for top-level routes. |
| User Edit document action | The button was missing despite a direct grant to `WebObjectDocuments` and the User Edit view action. | Fixed in Stage 4. |

Previously a 401 from one owning service cleared the entire React session. React now asks CoreService for the authoritative session status before clearing it and combines overlapping checks. The focused Chrome fixture passed. The live browser kept its active session while displaying the individual request failure.

### Stage 2 — Asset, Event, Notification, and Configuration

| Pages | Signed-in result |
| --- | --- |
| Asset List and Asset Dashboard | Asset list, type lookup, and type counts returned HTTP 200. |
| Event List and Event Record Search | Event list, search choices, and the manual read-only event search returned HTTP 200. |
| Event Dashboard | HTTP 400. The backend log identified a missing `PostgresEventEntityManager` factory in the Event request context. EventController now registers the existing datasource factory when available. The CoreService build passed. A signed-in retest against the rebuilt process is pending. |
| Notification Template List and Notification List | Both list requests returned HTTP 200. |
| Configuration Element Type List, Element List, and Element Tree | Type, element, and lookup requests returned HTTP 200. |

### Stage 3 — Security, customers, and licences

User List search loaded live rows. User View opened, and the User List's Roles and Access Models buttons opened their respective dialogs for the selected user. The scoped User Roles, Access Models, Role Users, Workgroup Users, and Customer Licences pages opened and issued successful reads. Role List, Workgroup Tree, Customer List, and Licence List also loaded successfully.

### Stage 4 — Document Service

The workspace dropped the shared `WebObjectDocuments` form from its navigation graph because the form's parent was absent. User Edit now checks the direct shared form grant and still requires the existing User Edit action grant. This matches the owning backend's authorization check. The signed-in dialog loaded its document list. The CoreService browser endpoint and the downstream Document Service operation both returned HTTP 200. The live check submitted no uploads or deletes.

### Automated verification

The full Chrome fixture suite passed all 76 cases after the session fix. After the Document permission fix, five focused Chrome cases passed against the final React build, covering session revalidation and the User Edit document dialog at four viewport sizes. The React production build, TypeScript, ESLint, and all 18 unit tests passed. CoreService compiled the Event Dashboard change with zero errors and zero warnings.

## Owning service session validation and final signed-in retest

### Stage 1 — Session validation and restart

CoreService restarted on port `9100`. Data Management, Workflow, JSON Object, Report, and AIFramework were rebuilt with owner-side browser authentication. Each owning service validates the cookie and required CSRF through the existing Security session authority and handles its own business request. Internal bearer callers keep the bearer path. User Edit's existing scoped Document integration remains covered by the Document retest above. Agent Service was excluded.

The private validation endpoint is reachable only via loopback and requires a server-held key. Its responses bypass the normal request and response body logger. The browser receives no bearer credentials. The development hosts use `BrowserSession__Origin=http://127.0.0.1:5174` and `BrowserOwnerSession__Authority=http://127.0.0.1:9100`. CoreService and the owning hosts obtain the same `BrowserOwnerSession__Key` from server-only configuration. The owner operation allowlist and existing page/action grants control what the browser can call.

The current Queue Item and Runtime Table Row permission model assigns New and Edit to the list and Save to the editor. The browser save operations require the editor's Save grant and retain the existing list scope. Signed-in saves with the corrected grant mapping remain unverified.

Negative live checks returned HTTP 401 for anonymous owner access, HTTP 403 for a bearer on the browser authority and for cross-origin requests, and HTTP 404 for the private endpoint without its key and an unlisted AI operation.

### Stage 2 — AI module grant

The database transaction added one `AIFrameworkGroupModule` Execute row for the existing `Administrator` role (`accessmodels.id = 1548`). The signed-in workspace displayed the AI Framework module after a reload. The matching seed row was added for future database initialization. No migrations were run.

### Stage 3 — Live results

| Pages | Result |
| --- | --- |
| Event Dashboard | The rebuilt CoreService returned HTTP 200 and the charts opened. |
| Service Dashboard, Cache Items, Queue List, Runtime Tables | Data Management returned HTTP 200. The service dashboard analytics also returned HTTP 200 from Event. |
| JSON Object Management | The type and schema lookups and a non-CMS object search returned HTTP 200. |
| Workflow Inbox | The owning request returned HTTP 200. Fixed the untranslated Complete and Object ID labels and verified the Turkish text in the browser. |
| SQL Client | Report returned HTTP 200 for the connection lookup. The configured allowlist is empty, so execution was unavailable in this environment. |
| AI Framework Dashboard, AI Provider Dashboard, Command Activity | One initial dashboard call returned HTTP 400 due to concurrent writes in the shared PostgreSQL datasource cache. The cache now synchronizes initialization and clearing. After restarting AIFramework with the fix, all 15 completed requests across the dashboards, lookups, and command activity search returned HTTP 200. |

The final pass used live reads. It did not submit SQL, business mutations, or document changes. All 18 React unit tests, TypeScript, ESLint for the touched page, and the React production build passed.

## Retest against project Debug executables

The signed-in browser visited all 31 migrated routes, including Agent Dashboard, and eight shared pages. React was listening on `5174`. CoreService, Workflow, JSON Object, Data Management, Report, SocketMessage, Agent, and AIFramework were running as project Debug executables. Document Service had no listener on `9110` when the checks ran.

| Pages | Result |
| --- | --- |
| Asset, Event, Notification, Configuration, Security, Customer, and Licence routes | Twenty CoreService routes loaded without a visible request error. Event Dashboard and the read-only Event Record search returned HTTP 200. User View opened, and its Roles and Access Models links opened their dialogs. |
| Shared signed-in pages | Home, Profile, Preferences, Sessions, Change Password, Contact, Licence, and About opened without a visible request error. |
| Service Dashboard, Cache Items, Queue List, Runtime Tables | Data Management returned HTTP 403 to all four signed-in reads. |
| JSON Object Management, Workflow Inbox, SQL Client | JSON Object, Workflow, and Report each returned HTTP 403 for the initial lookup or list. |
| AI Framework Dashboard, AI Provider Dashboard, Command Activity | The AI module and all three routes opened. AIFramework returned HTTP 403 to their reads. |
| Agent Dashboard | `getagentsinfo` and `getagentscountbytype` returned HTTP 401. The Debug Agent host was listening on `9800`. Agent Service has no browser-session owner registration. |
| User Edit → Documents | The dialog opened. CoreService returned HTTP 400 after logging that Document Service was inaccessible. No process was listening on `9110`. |

The five independent services returning HTTP 403 have neither `BrowserSession:Origin` nor `BrowserOwnerSession:Authority` in their copied Debug appsettings. The earlier successful temporary launches supplied those settings and the shared key at process start. The test did not change configuration, restart any service, or submit writes.

After Document Service started from its Debug executable on `9110`, the signed-in User Edit → Documents retest loaded the grid. Both CoreService and Document Service logged HTTP 200 for `getobjectdocuments` at 17:45 local time. The other service failures were outside this retest.

## Debug browser session configuration fix

Added the local React origin and CoreService session authority to the six owning services' Development appsettings. CoreService and these six Debug projects use the shared `.NET` user-secrets ID `DCPCoreX.Debug.BrowserOwnerSession`. The local account's user secrets store supplies `BrowserOwnerSession:Key` to all seven hosts, so launching the Debug executables directly no longer requires injecting the key into each process. Release builds do not include that user-secrets ID.

Agent Service now uses the same browser-session validation for its Dashboard list and count operations. Both require `WebAgentDashboard` for the common customer. A browser request to the unlisted Agent save endpoint returned HTTP 404 before reaching the controller.

CoreService and the six owning services rebuilt and started from their project Debug folders. CoreService's private validator returned HTTP 404 without the key and HTTP 401 with the key and an invalid session. All six owning services returned HTTP 401 for a deliberately invalid browser session, which confirms that they reached session validation through their Debug settings.

After a fresh sign-in, all 11 previously failing routes loaded without request errors. The owning service logs confirmed HTTP 200 for both Agent Dashboard reads, all four Data Management reads, Workflow Inbox, the JSON Object lookups and search, the Report connection lookup, and the three AIFramework pages including the command activity search. These were read-only checks. No SQL was executed.

## ServiceUser JWT replaces the shared key

The six owners now authenticate to CoreService's loopback-only validator with their existing ServiceUser JWT. CoreService validates the signed JWT and checks that its service-qualified username matches the owner of the allowlisted operation. It then validates the separate browser session, CSRF where applicable, and user permissions. The owner executes the operation under the signed-in user's identity.

Removed the extra key from the local .NET user-secrets store and the temporary launch copy. The private endpoint returned HTTP 404 for an anonymous request, a malformed bearer JWT, and the former key. The six Debug executables reached session validation and returned HTTP 401 for a deliberately invalid browser session.

All 11 affected pages passed a fresh signed-in read-only retest. The owning logs confirmed HTTP 200 for Agent Dashboard's list and count, four Data Management reads including a Queue List refresh, Workflow Inbox, JSON Object lookups and search, the SQL connection lookup, and the AI dashboards and Command Activity search. SQL Client reported an empty browser connection allowlist, so no SQL execution was tested. CoreService and the owning Debug services were left running.

## Licence maintenance

On the newer CoreService build, the signed-in Licence list returned three records. The edit form loaded the selected Licence’s existing application mapping and seven application choices. The New Licence form kept Add Application disabled before the first save. The Delete confirmation opened and was cancelled. The live check submitted no writes. Chrome fixtures cover creating a Licence, saving its mappings, rejecting duplicate choices, and deleting the Licence.

## Shared Documents and Workflow retest on 26 November 2026

React and nine application services were rebuilt and restarted. Workflow Service initially received HTTP 502 from the gateway during its startup authentication. After CoreService became reachable through the gateway, restarting Workflow succeeded and all nine service ports were listening.

After sign-in through React on port 5174, User Edit opened Documents and Refresh loaded the grid. CoreService and Document Service both recorded HTTP 200 for the list operation. Workflow Service returned HTTP 200 for the signed-in Inbox, including the All status filter. The live Inbox had no work items. Batch uploads and Complete and Cancel were exercised with fixtures. Live writes, populated workflow targets, SQL execution and Release/HTTPS are still unverified.

## Route and action comparison on 27 November 2026

No live service checks were run for the changes from this comparison. Chrome fixtures verified that Customer List CSV contains the signed-in tenant's rows, Event Records CSV spans multiple API result pages with the same filters, and Configuration version Delete submits the selected version and element IDs after confirmation, then refreshes the list. The fixture mocked CoreService. The scoped Configuration deletion endpoint and the new exports still need signed-in owner verification.

Protected payload views for Configuration, Event Records, and AI Command Activity are deferred to ReleaseTODO items R6 and B12. No protected content was added to the browser responses in this pass.

The follow-up Chrome fixtures verified new Customer creation, the administrator status and retry dialog, Configuration version New and Edit without protected content in the request, and confirmation and submission of equivalent-grant cleanup. Each workflow was exercised in mobile portrait, short landscape, tablet, and desktop. The fixtures mocked owner responses. CoreService and Data Management compiled in Debug. Signed-in provisioning, Configuration version writes, and authorization and persistence for grant cleanup still need live verification.

Final code verification covered all 101 Chrome fixtures. Configuration fixtures verified schema changes, object-scope changes with write-only replacement, and an empty replacement field on reopen. Access Model fixtures verified that editing a conflicting grant submits the selected grant ID and status. These fixtures mocked owner responses. CoreService and Data Management Debug builds passed. Live persistence, authorization and log redaction were not exercised.

## Signed-in menu and action audit on 28 November 2026

The Turkish Administrator session in the VS Code integrated browser opened all 24 Core sidebar links, the seven other registered Core routes through their direct URLs, and all eight shared signed-in pages. The seven direct routes covered Configuration Element Types, Configuration Elements, User Roles, Role Users, Workgroup Users, Access Models and Customer Licences. Sign-out redirected to sign-in. The password-recovery help link displayed administrator instructions and returned to sign-in.

| Owning capability | Live browser observations |
| --- | --- |
| Security and Configuration | User search and refresh worked. User New, Edit, View, Delete confirmation, Roles and Access Models opened. Role and Workgroup membership and access-model dialogs opened. Configuration Versions returned a row, and New, View, Edit and Delete confirmation opened. The replacement JSON field was empty on Edit. Customer New, administrator setup status and scoped Licences opened. Customer CSV saved with the same single row and five columns shown in the grid. Licence Edit opened. |
| Asset, Event and Notification | Asset List and Dashboard opened. Asset refresh completed. Event definitions returned rows and the selected Event's Notifications dialog opened. Event Records search completed with zero rows for both the default dates and a one-month window. Notification List and Template List returned rows. New and Edit opened for both. |
| Data Management and Agent | Service Dashboard rendered the live registration table. Cache and Queue refreshes returned empty grids. The Cache Clear confirmation opened and was cancelled. Runtime Tables returned a populated table. Rows, New and View opened. Agent Dashboard loaded the list and counts and refreshed to zero records. |
| Document, Workflow, Report, JSON Object and AIFramework | User Edit Documents listed the existing attachment and refreshed. Download saved a 4,013-byte file. Workflow Inbox loaded with both Active and All filters. Report rendered its connection-availability message. JSON Object search completed and enabled New. Both AI dashboards rendered their empty states, and Command Activity displayed its search filters and empty results. |

| Failure or limitation | Observed result |
| --- | --- |
| Documents Preview | The text attachment exposed an enabled Preview action. Clicking it displayed “Bu özellik şu anda kullanılamıyor.” The implementation supports JPEG, PNG, GIF and PDF previews. Download was available for the text attachment. |
| Turkish localization | The Configuration Management and Notification Management submenu headings displayed English in the Turkish workspace. Workflow Inbox also displayed the column label “Group.” |
| Applications | AI Data Analytics and Collaboration switched to Home with an empty sidebar. Service Dashboard showed both corresponding services as unregistered. Switching back to DCP Core restored its sidebar. |
| SQL execution | The Report connection lookup completed. The application reported that no browser report connection was configured and kept Run disabled. |
| Actions requiring records or submissions | Workflow History and transition actions, Queue Items, Cache value detail and populated Event Records export could not be verified with the data returned. Live saves, delete submissions, permission changes, customer setup retry, uploads and password changes were not submitted. |

Live outcomes above are based on rendered responses through the running React proxy. Per-action HTTP statuses were not captured. Separately, the production build, TypeScript and all 101 Chrome browser fixtures and 18 unit tests passed. The browser fixtures use mocked services and include mobile portrait, short landscape, tablet and desktop coverage.

### Text preview and Turkish label retest

Reloaded the running React app on port 5174 in the Turkish Administrator session. User Edit → Documents → Preview opened the existing `Notes.txt` attachment and rendered its text. Escape closed the preview and returned to the Documents list. The sidebar displayed **Yapılandırma Yönetimi** and **Uyarı Yönetimi**, and both groups expanded to show their links. Workflow Inbox loaded and displayed **Çalışma Grubu** as its workgroup column header. Live service results were observed in the browser.

Separately, all 14 focused Chrome fixtures passed, including text preview on mobile portrait, short landscape, tablet and desktop. The preview cases used the browser download contract's octet-stream MIME type and verified that HTML-like content remains literal, long lines wrap, the dialog scrolls, and Close stays reachable. The production build, TypeScript, targeted ESLint and all 18 unit tests passed.
