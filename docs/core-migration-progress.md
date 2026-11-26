# Core module migration progress

The legacy inventory contains 67 non-CMS Razor components, including 31 routed pages. React registers all 31 routes. Related operations with outstanding work are listed below. CMS Management is outside this migration.

| Legacy group | Razor components | Current React coverage |
| --- | ---: | --- |
| Access Management | 2 | Access Model tree and individual grant dialog. Duplicate grants are read-only. |
| Agent Management | 1 | Dashboard calls Agent Service for registered agents and counts by type. Older, unscoped runtime registrations must register again with the updated owner. |
| AI Management | 4 | Framework and provider dashboards and command activity search call AIFramework Service. Activity detail exposes metadata, usage, and costs. Raw commands, parameters, and error text need an approved redacted projection. |
| Asset Management | 3 | Asset list, editor, exports, and date-filtered dashboard implemented. |
| Configuration Element Management | 9 | Type list and editor, schema version maintenance, element list and tree, element metadata maintenance, and scoped value-version metadata implemented. Value editing needs a field-level browser contract for protected settings. |
| Customer Management | 2 | Customer list and existing-record maintenance implemented. Customer creation and administrator provisioning status depend on the first-administrator admission rule in CONF-043. |
| Event Management | 5 | Dashboard, definition list and editor, Event Notification mappings, and tenant-scoped record search and metadata detail implemented. Cross-customer search and raw event body access still need an approved authorization and projection contract. Event record exports cover the current result page. |
| JSON Object Management | 2 | Search, editor, and lifecycle operations call JSON Object Service. Object and parent IDs retain their full precision. Store selection stays in the owning manager. |
| Licence Management | 4 | Licence and Customer Licence lists, details, and maintenance implemented. |
| Notification Management | 6 | Definition and template lists and editors implemented, including channel items, language content, and Event Notification mappings. |
| Report Management | 1 | SQL Client calls Report Service. The browser selects from configured connection keys and displays returned rows. |
| Role Management | 4 | Role list, editor, and Role User membership dialogs implemented. |
| System Management | 10 | The Service Dashboard calls Service Management and Event. Cache, queue, and runtime table pages and related dialogs call Data Management Service. |
| User Management | 4 | User list, editor, related Roles and Access Models, and User Role membership dialogs implemented. |
| Workflow Management | 6 | Inbox, history, and transition dialogs call Workflow Service. Delegation choices come from Security. |
| Workgroup Management | 4 | Workgroup tree, editor, and Workgroup User membership dialogs implemented. |

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
| Queue item and runtime table row saves | React shows New and Edit under separate grants. Data Management's upsert requires both grants, so either action can be offered to a user whose save would be forbidden. |
| Document IDs | Document Service returns a `long`. The React document-list request uses ordinary JSON parsing before a safe-integer check. A numeric document ID above `Number.MAX_SAFE_INTEGER` can fail decoding the entire list. |
| Workflow Open | The action checks that the server-supplied URL is local. It can still navigate to the missing page when that URL has no matching React route. Actual work-item targets need validation with populated data. |
| Legacy feature parity | Customer creation and first-administrator provisioning, Customer List export, configuration value-version editing and deletion, and broader event record and AI detail access are incomplete or deliberately limited. See the group inventory for applicable policy constraints. |
| Release and HTTPS | The current live evidence applies to Debug. Independent owner projects still target libraries in Release. The installed HTTPS environment must supply the exact browser origin and validator authority for the owning services. No end-to-end Release or HTTPS retest was performed. |
| SQL Client | The Report Service connection lookup passed. The browser connection allowlist was empty, so SQL execution remains unverified. |

## Earlier verification before the live rollout

The route inventory found 31 legacy routes and 31 registered React routes. After switching to canonical routes, TypeScript, ESLint, 18 unit tests, 75 Chrome fixture tests, and the React production build passed. The 11 additional pages opened on mobile portrait, short landscape, tablet, and desktop. Vite resolved all 12 checked prefixes to their intended owners. The generated NGINX configuration passed `nginx -t`.

CoreService, JSON Object Service, Data Management Service, AIFramework Service, and Report Service built with zero warnings and zero errors.

React was listening on 5174. CoreService on 9100 and the independent owner ports were unavailable. Live integration verification requires the latest running builds and the owning services. No services were restarted and no database migrations or live writes were performed.

## Previous verification stage

- React TypeScript, ESLint, production build, and 17 unit tests passed.
- All 69 Chrome fixture tests passed. Customer Licence, Asset, and Event tests cover mobile portrait, short landscape, tablet, and desktop. The fixtures also exercise scoped Customer Licence maintenance, exact Asset IDs, and Event definition maintenance.
- The isolated CoreService build passed with zero warnings and zero errors. The running CoreService still uses its previous build. The new endpoints have pending live verification.

The [live verification log](core-live-verification.md) records earlier live results. This stage made no database migrations or live writes.
