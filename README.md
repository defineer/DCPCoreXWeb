# DCPCoreXWeb

React and TypeScript web application for DCPCoreX. The first Core Application feature is User Management. It contains the routed UserList and a shared New/Edit/View UserEdit dialog. Roles, Access Models and individual dashboard pages are outside this delivery.

## Development

Use Node.js 24 and pnpm 11 with the checked-in lockfile.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Set `DCP_API_UPSTREAM` to the local Core Service origin in `.env.development.local` or in the environment that starts Vite. A process environment value takes precedence. The local setup uses Core Service at `http://127.0.0.1:9100` and Vite at `http://127.0.0.1:5174`. Vite forwards `/api` requests with their paths intact.

React uses `GET /api/session`, `POST /api/session/login`, and `POST /api/session/logout`. Core Service reuses the credential and OTP logic behind Blazor's `POST /UserService/validateuser`. In development, the Core Service browser origin defaults to `http://127.0.0.1:5174`. Set `BrowserSession__Origin` to the exact browser origin for HTTPS. Sessions are held in memory in the single Core Service process, so a restart requires signing in again.

The UI follows the official shadcn Vite setup. The centered auth card follows `login-01` and the icon rail follows `sidebar-07`, composed around the DCP navigation graph, routing and session contracts. `components.json` configures shadcn, and `src/styles/theme.css` owns the brand, hover, selected-row, chart and focus colors. Existing image folders are in `public/images`.

## Ownership

- `src/app` owns routing, authentication, menu composition, and preferences.
- `src/shared` owns typed transport, common contracts, globalization, form state, validation, logging, dialogs, toasts, error boundaries and reusable UI.
- `src/common-pages` owns Login, Reset Password, Change Password, MainPage, Profile, Preferences, Sessions, Contact, Licence, About and fallback screens.
- `src/modules/core/users` owns UserList, UserEdit, their domain fields, grants and API operations.
- Reusable dashboard and workflow controls are in `src/shared/ui`. No dashboard domain routes are registered.

The first Core localization files are a checksum-pinned snapshot of the current canonical DCPCoreX JSON files. To refresh them, use the published Core artifact and its manifest with `pnpm resources:import <extracted-core-directory> <pinned-manifest>`. The importer checks the pinned SHA-256 values. Site-specific UI strings are owned under `src/locales/ui`.

## HTTPS with the existing certificate

```powershell
$env:DCP_API_UPSTREAM = 'http://127.0.0.1:9100'
$env:DCP_NGINX_MIME = 'C:/path/to/nginx/conf/mime.types'
pnpm build
pnpm https:configure
```

The generated `.local/nginx.conf` references the existing `dcpcore.crt` and `dcpcore.key` in place. It defaults to `dcpcore.com` and ports 80/443. Override with `DCP_HTTPS_HOST`, `DCP_HTTP_PORT`, `DCP_HTTPS_PORT`, `DCP_TLS_CERT`, and `DCP_TLS_KEY` as needed. The supplied hostname must match the certificate. Run NGINX syntax validation with `nginx -t -c C:/Work/DCPCoreXWeb/.local/nginx.conf` under the intended NGINX prefix, then deploy under that prefix. Configure DNS and browser trust using the owning environment. The certificate key is never copied into the app or served from `dist`.

The HTTPS host serves the built SPA, applies security headers, and proxies the same-origin `/api` boundary. The upstream must be the browser facade, which owns the cookie, CSRF enforcement, actor and tenant authorization, session deadlines, and revocation. Keep any direct bearer service outside the browser surface.

## Verification

Build before calling `pnpm test:browser`. Use `DCP_BROWSER_CHANNEL=msedge` to select an installed Edge browser, or install the default Playwright browser in the test environment. `DCP_FIXTURE_PORT` overrides the loopback fixture port. Fixture tests exercise real components and routing with temporary browser interception. Setting `DCP_TEST_BASE_URL` to a dedicated HTTPS test deployment selects the separate live suite. Keep authenticated test data isolated and use dedicated approved identities for manual/live authorization acceptance. Browser trace, screenshot and video capture are off by default to avoid retaining typed credentials or user data.

## Integration decisions and release checks

- Verify live React sign-in against the running Core Service. The fixture suite exercises the React UI with temporary browser interception.
- The browser password recovery flow expects an approved anonymous reset facade operation with a pre-login CSRF context. Confirm that binding with Security.
- UserList exports the currently displayed page and requires the explicit `WebExportUsers` grant. The reviewed seed did not define that grant. Align that action with the backend authorization catalog before live export acceptance. The PDF export is a raster table so Turkish characters retain their appearance.
- Remember Me is omitted until a supported browser-session preference exists. No credential storage is used.
- The current backend views expose audit actor IDs in UserEdit. Display names and the richer legacy application metadata require approved public projections. The current About page shows the frontend version.
- Certificate and key validation does not establish deployed routing. Verify the NGINX host, trusted TLS, facade, and authenticated operation/tenant tests before release.
