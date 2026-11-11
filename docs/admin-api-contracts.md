# Admin API integration

Authentication uses same-origin requests to `/api/auth` and the Express session cookie. The Angular dev server proxies `/api/**` to `http://localhost:3500`. In production, serve the CMS and API on the same HTTPS origin and route `/api` to Express before applying the Angular route fallback.

The CMS restores the current identity through `GET /api/auth/me` and keeps the CSRF token in memory. The HTTP interceptor adds the token to authenticated API writes. The backend API documentation is in the backend repository at `docs/auth-api.md`.

| Area | Pending endpoints |
| --- | --- |
| Platform | List and manage businesses, users and business memberships. |
| Business | Provide scoped dashboard summaries and endpoints for products and variants, inventory movements, conversations and messages, orders, AI settings and schedules. |

For business requests, the server must derive the active business from the authenticated session and verify membership and permissions. Any future workspace switch must verify membership before updating the session. Use 401 for missing or expired sessions and 403 for insufficient permissions. Exclude password hashes and Facebook Page tokens from all admin responses.
