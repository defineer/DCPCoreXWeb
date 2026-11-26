# DCPCoreXWeb Agent Guide

## Source of truth

- The authoritative project documents are in `C:/Work/DCPCore/Src/Common/DCP.Core.Common/Docs/DCPCoreNextDocs`. For web changes, read `Project Information.txt`, `Principles/Web UI Principles.txt`, `Requirements/22 - Web UI Requirements.txt`, and `Requirements/32 - Web UI Migration Requirements.txt`. Read the applicable service, client, security, and document requirements when changing those contracts.
- Use the non-CMS Core Blazor pages under `C:/Work/DCPCore/Src` as the approved behavior and visual reference for this migration. Keep their React implementations grouped by feature under `src/modules/core`. Use User List and User Edit as references for related actions, dialogs and permissions. Treat legacy application source as read-only.

## React presentation

- Reuse the shared page, toolbar, form, dialog, grid, and toast components. Keep theme, hover, focus, and selected states in `src/styles/theme.css`. Keep domain permissions and operations with their owning feature.
- Keep fields within their groups. Use available-width sizing with responsive maximums and stack groups when space runs out. Keep wide grid scrolling inside the grid, and make dialog bodies and short-screen menus scroll without losing access to close and confirmation actions.
- For responsive verification, exercise every affected route and its reachable dialogs, menus, and grids at mobile portrait, short landscape, tablet, and desktop sizes. Check for page-level overflow, reachable controls, and local grid scrolling. Report fixture tests separately from live service checks.

## API and development

- Use same-origin `/api` with the CoreService browser session cookie and the required CSRF header. Keep bearer and refresh tokens in the backend. Independent services validate browser sessions through CoreService's private validator using their existing ServiceUser JWT and enforce operation permissions as the signed-in user. See SEC-050 and SVC-086.
- Keep `/resetpassword` as localized help under WEB-084 and SEC-049. Direct users to their administrator, provide a return to sign-in, and keep the legacy email-only reset operation outside browser ingress. Enable self-service only through the approved Security recovery flow.
- Vite and the React static NGINX host forward `/api` paths intact. Use the owner map in `vite.config.ts` and `deploy/nginx.conf.template` with SVC-084. CoreService on local port 9100 receives session, co-hosted and approved adapter routes. Data Management, Workflow, JSON Object, Report, Agent and AIFramework receive their own browser routes. User Edit documents use the scoped CoreService adapter to Document Service.
- F5 runs the `Start DCPCoreXWeb Vite` prelaunch task. `Build DCPCoreXWeb` runs the separate production build. Use SVC-087 and SVC-088 for local Debug service launch.
- Keep the React static-host configuration separate from the installed backend NGINX gateway. The backend gateway uses plain `/api/<service>/` locations for migrated services. Use the Service Requirements for gateway startup and reachability checks. Keep staging and commits with the user.

## Migration verification

- Verify migrated routes signed in against their owning services, including Agent Dashboard. Record route and action coverage, fixture results, owning-service responses and unverified cases separately in `docs/core-migration-progress.md` and `docs/core-live-verification.md`.
