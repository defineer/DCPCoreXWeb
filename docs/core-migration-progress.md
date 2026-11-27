# Core module migration progress

The legacy inventory contains 67 non-CMS Razor components, including 31 routed pages. React registers all 31 routes. Related operations with outstanding work are listed below. CMS Management is outside this migration.

| Legacy group | Razor components | Current React coverage |
| --- | ---: | --- |
| Access Management | 2 | Access Model tree, individual grant dialog, and export. Users can select an individual grant on a conflicting row to view it or edit its status, as in Blazor. Authorized users can also resolve equivalent duplicates. |
| Agent Management | 1 | Dashboard calls Agent Service for registered agents and counts by type. Older, unscoped runtime registrations must register again with the updated owner. |
| AI Management | 4 | Framework and provider dashboards and command activity search call AIFramework Service. Activity detail exposes metadata, usage, costs, and both provider unit prices. Protected command, parameter, and error views are tracked in ReleaseTODO. |
| Asset Management | 3 | Asset list, editor, exports, and date-filtered dashboard implemented. |
| Configuration Element Management | 9 | Type, schema, and element maintenance. The scoped value-version list supports New, View, Edit, Delete, and metadata export. New and Edit support schema and tenant-scoped object selection and write-only JSON replacement. Protected value detail is tracked in ReleaseTODO. |
| Customer Management | 2 | Customer list, exports, New, existing-record maintenance, and first-administrator setup status and retry. Under CONF-043, provisioning uses the existing setup-specific Security path and login evaluates the customer's licence. |
| Event Management | 5 | Dashboard, definition list and editor, Event Notification mappings, and tenant-scoped record search, metadata detail and export. The browser remains scoped to the signed-in tenant. Protected event detail is tracked in ReleaseTODO. |
| JSON Object Management | 2 | Search, editor, and lifecycle operations call JSON Object Service. Object and parent IDs retain their full precision. Store selection stays in the owning manager. |
| Licence Management | 4 | Licence and Customer Licence lists, exports, details, and maintenance implemented. |
| Notification Management | 6 | Definition and template lists and editors implemented, including channel items, language content, and Event Notification mappings. |
| Report Management | 1 | SQL Client calls Report Service. The browser selects from configured connection keys and displays returned rows. |
| Role Management | 4 | Role list, editor, and Role User membership dialogs implemented, with exports for both lists. |
| System Management | 10 | The Service Dashboard calls Service Management and Event. Cache, queue, and runtime table pages and related dialogs call Data Management Service. Queue Item and Runtime Table Row lists support exports. |
| User Management | 4 | User list, editor, related Roles and Access Models, and User Role membership dialogs implemented. User Role membership supports exports. |
| Workflow Management | 6 | Inbox, history, and transition dialogs call Workflow Service. Delegation choices come from Security. |
| Workgroup Management | 4 | Workgroup tree, editor, and Workgroup User membership dialogs implemented, with exports for both lists. |

## Service ownership

The earlier pages use the appropriate Security, Configuration, Asset, Event, and Notification subcontrollers hosted by CoreService. The User Edit document panel uses the existing Document Service client behind its browser endpoint.

The eleven additional pages use the canonical `/api/<service>/<operation>` paths of their Blazor references. Vite and the React static host route each service prefix to its existing local upstream. CoreService handles its own modules. Agent, AIFramework, Data Management, JSON Object, Report, and Workflow respond on their own ports.

| Owner | Local upstream |
| --- | ---: |
| CoreService | 9100 |
| Workflow | 9120 |
| JSON Object | 9130 |
| Data Management | 9500 |
| Report | 9650 |
| Agent | 9800 |
| AIFramework | 9920 |

The SQL Client lists approved names from `BrowserReport:ConnectionKeys` in Report Service. Each key must resolve to a Report connection with the intended database-level privileges. The independent services now use their existing ServiceUser JWT to authenticate to CoreService's private session validator. They execute each permitted operation under the signed-in user's identity.

## Transformation review on 26 November 2026

- The 67 non-CMS Razor components include 31 routable pages. The React router contains all 31 paths. A signed-in Debug browser check opened those 31 and eight shared pages without a visible request error.
- All 51 independent-service browser allowlist entries match a real handler and HTTP method in the owning service. Vite and the React NGINX template use the same six independent owner groups. CoreService handles its co-hosted management areas. Service Dashboard combines Data Management and Event. Workflow delegation obtains its users from Security. User Edit documents pass through the scoped CoreService browser endpoint, and the Document Service log confirmed its read returned HTTP 200.
- TypeScript, the React production build, 18 unit tests, and 76 Chrome fixture tests passed. Fixture coverage is separate from signed-in Debug reads. This review submitted no live writes, SQL execution, grants, or migrations.

### Remaining cases

| Case | Finding |
| --- | --- |
| Queue item and runtime table row saves | New and Edit use their respective list action grants and require access to the editor. Save uses the editor's separate Save grant. Data Management checks the editor and Save grant along with the existing list scope. Signed-in save verification remains open. |
| Documents and Workflow | The document ID parser and Workflow Open route checks were fixed in the shared component stage. Signed-in Documents list and Refresh and Workflow Inbox returned HTTP 200. The live Inbox had no work items. Live document writes, actual work-item targets and transitions remain unverified. |
| Legacy feature parity | Protected payload views are deferred to ReleaseTODO. A Configuration version with nonempty content can move scope only when its content is replaced in the same write. Conflicting Access Model grants use Blazor's per-grant status editor. Event Records remain tenant-scoped by decision. |
| Release and HTTPS | The current live evidence applies to Debug. Independent owner projects still target libraries in Release. The installed HTTPS environment must supply the exact browser origin and validator authority for the owning services. No end-to-end Release or HTTPS retest was performed. |
| SQL Client | The Report Service connection lookup passed. The browser connection allowlist was empty, so SQL execution remains unverified. |

## Route and action comparison on 27 November 2026

- Inventoried all 67 in-scope Razor components and matched all 31 routed paths against the React route table. Compared declared page actions and legacy export handlers with the React implementations. This static comparison did not verify every field, state, or interaction.
- Restored Configuration value-version Delete with confirmation, an element- and customer-scoped browser endpoint, and the existing Configuration soft delete. The Versions list continues to return metadata. Protected detail is deferred to ReleaseTODO items R6 and B12.
- Restored exports for Configuration version metadata, Customers, Licences, Customer Licences, Access Models, Roles, Workgroups, their membership lists, Queue Items, and Runtime Table Rows. Event Records can now export all filtered records through the existing tenant-scoped paged reads. The browser abandons the export if the total changes or the collected rows contain duplicate keys.
- Restored the AI activity detail's input and output unit prices using the existing metadata response.
- TypeScript, lint for the changed files, the React production build, 18 unit tests, and 85 Chrome fixtures passed. The CoreService deletion endpoint was reviewed in source. A backend build and signed-in owner verification remain open.

### Follow-up parity changes

- Added authorized Configuration version New, View, Edit, and Save for version metadata and status. The owner assigns new content from an active default for the same customer, element, and schema, with the legacy empty JSON fallback. Existing saves use the scoped record and its expected update timestamp, and preserve content, schema, and object scope.
- Added common-scope Customer New and a first-administrator status and retry dialog. The browser uses separate Add and Save grants. Initial setup uses the existing immediate or queued path and can proceed without a valid licence under CONF-043. Existing-customer edits no longer start administrator setup. Retries reuse a customer-bound queue key. Data Management rejects Save and Move into the Security queue.
- Added authorized cleanup of equivalent Access Model grants. The Security owner rechecks the tenant, principal, element, grant IDs, delegated right, and current state in the save transaction. It retains one grant and soft-deletes redundant grants with the same right and state.
- Confirmed the Event Records scope decision. Search, detail, and exports remain bound to the signed-in tenant. Protected payload work remains in ReleaseTODO.
- TypeScript, lint for the changed React files, the production frontend build, and the 88-test Chrome regression run passed. The three new workflows also passed all 12 targeted cases across mobile portrait, short landscape, tablet, and desktop.
- CoreService and Data Management Debug builds passed with zero warnings and errors. Build verification did not exercise tenant data, queue delivery, or sign-in.

### Configuration version schema and object scope

- Added schema selection to existing version edits and user, role, and workgroup selection to New and to edits of empty versions. The Configuration owner validates schema ownership and content compatibility. Security supplies active object choices scoped to the signed-in tenant. Saved values stay on the server.
- CoreService Debug compiled with zero warnings and errors. TypeScript and the React production build passed. All four targeted Configuration fixtures passed, covering schema selection, exact object identifier submission, and scope locking for nonempty content.

### Protected Configuration writes and per-grant Access Model editing

- Added write-only JSON replacement. The owner validates the new value against its schema and keeps stored content out of browser responses. The endpoint excludes HTTP body logging and requires EF sensitive-data logging to be disabled. Configuration version content is excluded from entity-change events, while record and status metadata remain available.
- Matched Blazor's individual View and status Edit for grants attached to a conflicting tree row. The Security owner rechecks the selected grant's tenant, principal, element, delegated right, and expected state. Equivalent duplicate cleanup remains a separate confirmed action.
- CoreService and Data Management built in Debug with zero warnings and errors. TypeScript, scoped lint, the React production build, 18 unit tests, and all 101 Chrome fixtures passed. The new grant and Configuration fixtures covered mobile portrait, short landscape, tablet, and desktop.

## Shared Documents and Workflow acceptance on 26 November 2026

- User Edit opens the reusable Documents dialog with its existing scoped adapter. The dialog supports exact 64-bit document IDs, metadata, Refresh and multi-file selection with individual results.
- Workflow Inbox uses shared History and Transition dialogs. Workflow Service supplies and validates Complete and Cancel destinations. Open checks registered routes and page access before navigating.
- TypeScript, lint, the React production build, 18 unit tests and 82 Chrome fixture tests passed. Fixtures covered the shared dialogs on mobile portrait, short landscape, tablet and desktop, and exercised exact IDs, mixed upload outcomes and Complete and Cancel submission.

## Earlier verification before the live rollout

The route inventory found 31 legacy routes and 31 registered React routes. After switching to canonical routes, TypeScript, ESLint, 18 unit tests, 75 Chrome fixture tests, and the React production build passed. The 11 additional pages opened on mobile portrait, short landscape, tablet, and desktop. Vite resolved all 12 checked prefixes to their intended owners. The generated NGINX configuration passed `nginx -t`.

CoreService, JSON Object Service, Data Management Service, AIFramework Service, and Report Service built with zero warnings and zero errors.

React was listening on 5174. CoreService on 9100 and the independent owner ports were unavailable. Live integration verification requires the latest running builds and the owning services. No services were restarted and no database migrations or live writes were performed.

## Previous verification stage

- React TypeScript, ESLint, production build, and 17 unit tests passed.
- All 69 Chrome fixture tests passed. Customer Licence, Asset, and Event tests cover mobile portrait, short landscape, tablet, and desktop. The fixtures also exercise scoped Customer Licence maintenance, exact Asset IDs, and Event definition maintenance.
- The isolated CoreService build passed with zero warnings and zero errors. The running CoreService still uses its previous build. The new endpoints have pending live verification.

The [live verification log](core-live-verification.md) records earlier live results. This stage made no database migrations or live writes.
