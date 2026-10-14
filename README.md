# Karivia — Salon & Beauty Booking Platform

A modular React (JavaScript) + Vite application built to demonstrate the complete multi-role Karivia experience and to prepare the frontend for backend integration. **This is an API-ready frontend, not a production backend.** Demo login, OTP, document verification, payment, permissions, and persistence are simulated. Do not deploy with mock auth as a real consumer production service.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Run `npm run build` to produce production assets in `dist/`; `npm run preview` to preview those assets. `npm test` runs lightweight source/service-contract checks. Node.js 20+ recommended.

## Demo accounts

Select Customer, Salon, Freelancer, Admin, or Staff on `/login` (seeded emails shown there). Demo password is visual-only. Mock mode does not authenticate credentials or securely authorize mutations.

## Folder organization

- `src/api/client.js` — centralized Axios instance, timeout and error normalization.
- `src/services/resourceService.js` — interchangeable mock or live API CRUD façade.
- `src/services/*Service.js` — resource-specific service aliases.
- `src/services/mockStore.js` — asynchronous localStorage-backed mock CRUD implementation.
- `src/data/seed.json` — normalized realistic sample entities, IDs, statuses, timestamps and relationships.
- `src/context` — session and UI notification state.
- `src/hooks/useResource.js` — reusable asynchronous list loading and refresh.
- `src/layouts` — public header/footer and role-based workspace shell.
- `src/pages` — public, authentication and dashboard page modules.
- `src/components/UI.jsx` — reusable form fields, loading, table pagination, toasts and modals.
- `src/constants` — navigation and booking status values.
- `src/utils` — presentation helpers.
- `src/routes.jsx` — route map, protected workspace and dynamic URLs.

## Routes

Public: `/`, `/explore`, `/shop`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/providers/:id`, `/book/:providerId/:serviceId`, `/how-it-works`, `/for-business`.

Shop management: `/app/admin/shop`, `/app/admin/shop-categories`, and `/app/admin/shop-orders`. The Shop and Orders modules use a persistent local JSON prototype repository and stay local even when other modules use APIs. See [Shop documentation](docs/shop.md) for schemas, workflow rules, image limits, manual walkthroughs, and future API adapter contracts.

Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-otp`, `/verify-documents`.

Workspace: `/app/:role` for `admin`, `salon`, `freelancer`, `staff`, `customer`. Supported nested modules include `/bookings`, `/services`, `/staff`, `/providers`, `/customers`, `/verifications`, `/reviews`, `/calendar`, `/reports`, `/settings`, and `/saved` as appropriate for each role. A `*` route provides a 404 page. Vercel `vercel.json` rewrites support direct URL refreshes. For other hosting, configure all application routes to serve `index.html`.

## Switching to live APIs

1. Create `.env` from `.env.example`.
2. Set `VITE_DATA_PROVIDER=api` and `VITE_API_BASE_URL=https://your-api.example/v1`.
3. Implement backend endpoints using the contracts below. The UI calls `resource(kind)` rather than importing JSON.
4. Replace demo login in `AuthContext` with a secure authenticated session strategy (ideally short-lived tokens and httpOnly cookie refresh sessions); implement role and tenant authorization on the backend.
5. Implement backend verification, payments, notifications, booking locking and idempotent checkout. Client-side checks and localStorage are not secure substitutes.
6. Implement required file upload service and real server-side OTP issuance and verification. Never use mocked OTP in production.

**Expected list response**, for `GET /v1/{resource}?page=1&pageSize=8&search=...`: 

```json
{"data":[{"id":"svc_001","providerId":"prv_001","name":"Signature Haircut & Style","category":"Hair","duration":60,"price":1200,"active":true}],"total":1,"page":1,"pageSize":8}
```

**Read** `GET /v1/{resource}/{id}` returns an entity JSON object. **Create** `POST /v1/{resource}` accepts entity fields and returns the created entity. **Update** `PATCH /v1/{resource}/{id}` accepts partial changes and returns updated entity. **Delete** `DELETE /v1/{resource}/{id}` returns `{"success":true}`. Resource names: `providers`, `services`, `bookings`, `staff`, `users`, `verifications`, `reviews`, `categories`.

Examples:

```http
POST /v1/bookings
Content-Type: application/json

{"customerId":"usr_001","providerId":"prv_001","serviceId":"svc_001","date":"2026-10-21","time":"15:00","status":"pending","paymentStatus":"unpaid"}
```

```json
{"id":"BKG-2101","customerId":"usr_001","providerId":"prv_001","serviceId":"svc_001","date":"2026-10-21","time":"15:00","status":"pending","paymentStatus":"unpaid","createdAt":"2026-10-14T10:00:00Z"}
```

```http
PATCH /v1/verifications/ver_102
Content-Type: application/json

{"status":"approved"}
```

Real backend must check tenant ownership, provider verification state, staff availability, overlapping slot duration, payment lifecycle, cancellations, refunds, and audit logs atomically. The generic resource layer is an integration starting point, not a complete production domain contract.

## Mock data and limitations

Mock mutations persist in `localStorage` on the browser and broadcast `karivia:changed` to subscribed React hooks. Seed reset is available under workspace settings. Browser data is not shared across users/devices. No real credentials are validated, emails or OTPs delivered, files uploaded, payments taken, or messages sent. The sample metrics are illustrative, not live commercial data. External Unsplash sample images and Google Fonts require an internet connection.

## Deployment

Vercel framework: Vite; build command `npm run build`; output directory `dist`. Static SPA rewrite is in `vercel.json`. Set environment variables within Vercel project settings. For public demos keep `VITE_DATA_PROVIDER=mock`. Do not use the public demo as a production service for real customers.
