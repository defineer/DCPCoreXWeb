# DCPCoreXWeb Agent Guide

## Source of truth

- The authoritative project documents are in `C:/Work/DCPCore/Src/Common/DCP.Core.Common/Docs/DCPCoreNextDocs`. For web changes, read `Project Information.txt`, `Principles/Web UI Principles.txt`, `Requirements/22 - Web UI Requirements.txt`, and `Requirements/32 - Web UI Migration Requirements.txt`. Read the applicable service, client and security requirements. For shared toolbar work, also read `Requirements/17 - Document Requirements.txt` or `Requirements/28 - Workflow Requirements.txt` for the owning capability.
- Use the non-CMS Core Blazor pages under `C:/Work/DCPCore/Src` as the approved behavior and visual reference for this migration. Keep their React implementations grouped by feature under `src/modules/core`. Use User List and User Edit as references for related actions, dialogs and permissions. Treat legacy application source as read-only.

## React presentation

- Reuse the shared page, toolbar, form, dialog, grid, and toast components. Keep theme, hover, focus, and selected states in `src/styles/theme.css`. Keep domain permissions and operations with their owning feature.
- Treat List New, List Edit, and editor Save as separate actions with their own grants. Require editor page access for New and Edit. Render the editor read-only without Save. Apply MIG-019 to Queue Items, Runtime Table Rows and the five CoreService detail reads for Assets, Customers, Events, Licences and Customer Licences. For conflicting Access Model grants, select an individual record for View or status Edit under SEC-023.
- Use the Configuration owner's metadata and write-only replacement contracts under CONF-005 and CONF-013. Show tenant-scoped object choices from Security. Keep stored value content out of browser responses and exports. In Customer Management, use CONF-043 and SEC-037/SEC-040 for setup status and retry. Security evaluates licence eligibility at login.
- Keep Event Records search, detail, and exports scoped to the signed-in tenant. Full export uses the applied filters across all pages. Keep Configuration versions, Event Records and AI Command Activity on their approved metadata detail contracts until ReleaseTODO B12 and R6 deliver owner-approved redacted fields.
- Use the shared Documents button and dialog in `src/shared/ui/documents.tsx` with a record-bound, authorized adapter. User Edit uses its scoped Document Service adapter. Parse document IDs as exact strings, preserve them in metadata exports, and keep per-file results for batch upload. Offer XLSX, CSV and PDF metadata export under Document View access for the host record.
- Use `useWorkflowActions` from `src/modules/core/workflow/workflow-actions.tsx` for host toolbars and their History and Transition dialogs. Supply the active workflow identity, authorized actions, guard and completion callback as applicable. Use Workflow Service choices and validate the Open route and destination access. Provide an explicit Inbox Query action and show the state key in History and its export. See WEB-085 and MIG-024.
- Apply saved grid paging preferences where supported. Clear selection when the user changes result pages and preserve the declared export scope. Initialize My Sessions dates in the configured time zone.
- Show the signed-in customer's name and the user's full name on Home using the browser session projection. Use the preferred display name in the account menu.
- Keep fields within their groups. Use available-width sizing with responsive maximums and stack groups when space runs out. Keep wide grid scrolling inside the grid, and make dialog bodies and short-screen menus scroll without losing access to close and confirmation actions.
- For responsive verification, exercise every affected route and its reachable dialogs, menus, and grids at mobile portrait, short landscape, tablet, and desktop sizes. Check for page-level overflow, reachable controls, and local grid scrolling. Report fixture tests separately from live service checks.

## API and development

- Use same-origin `/api` with the CoreService browser session cookie and the required CSRF header. Keep bearer and refresh tokens in the backend. Independent services validate browser sessions through CoreService's private validator using their existing ServiceUser JWT and enforce operation permissions as the signed-in user. See SEC-050 and SVC-086.
- Keep `/resetpassword` as localized help under WEB-084 and SEC-049. Direct users to their administrator, provide a return to sign-in, and keep the legacy email-only reset operation outside browser ingress. Enable self-service only through the approved Security recovery flow.
- Vite and the React static NGINX host forward `/api` paths intact. Use the owner map in `vite.config.ts` and `deploy/nginx.conf.template` with SVC-084. CoreService on local port 9100 receives session, co-hosted and approved adapter routes. Data Management, Workflow, JSON Object, Report, Agent and AIFramework receive their own browser routes. User Edit documents use the scoped CoreService adapter to Document Service.
- F5 runs the `Start DCPCoreXWeb Vite` prelaunch task. `Build DCPCoreXWeb` runs the separate production build. Apply SVC-087 and SVC-088 to local Debug launches. Document, Workflow, JSON Object, Data Management, Report, Agent, and AIFramework deploy as separate production services. Verify CoreService is reachable through the configured gateway before launching owners that authenticate through it at startup.
- Keep the React static-host configuration separate from the installed backend NGINX gateway. The backend gateway uses plain `/api/<service>/` locations for migrated services. Use the Service Requirements for gateway startup and reachability checks. Keep staging and commits with the user.

## Migration verification

- Verify migrated routes signed in against their owning services, including Agent Dashboard. Record route and action coverage, fixture results, owning-service responses and unverified cases separately in `docs/core-migration-progress.md` and `docs/core-live-verification.md`.
- The implementation audit accounted for 67 Razor components and 31 non-CMS Core routes. Use the live verification log for open acceptance cases, including Home names, Edit without Save, populated Workflow actions, and configured SQL execution.
- Keep both migration documents in `DCPCoreXWeb/docs` and maintain them as part of agent work. Track production gates and deferred protected payload views in `C:/Work/DCPCoreX/Src/Common/DCPCore.Common/Docs/Deployment/ReleaseTODO.txt`.
