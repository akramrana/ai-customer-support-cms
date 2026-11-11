# Pending admin API contracts

The Express server currently exposes GET and POST for `/webhook/messenger`. The admin frontend is a static preview. Confirm paths and payloads before integrating these proposed capabilities.

| Area | Required capability |
| --- | --- |
| Authentication | Separate Super Admin and Business Admin sign-in entry points, current session lookup and session termination. Return the verified role and authorized workspace context. |
| Platform | List and manage businesses, users and business memberships. Establish a Super Admin role and enforce it on the server. |
| Business | Provide scoped dashboard summaries and endpoints for products and variants, inventory movements, conversations and messages, orders and AI settings and schedules. |

For business requests, the server must derive the active business from the authenticated session and verify membership and permissions. If a user belongs to multiple businesses, any workspace switch must verify membership before updating the session. Use 401 for missing or expired sessions and 403 for insufficient permissions. Exclude password hashes and Facebook Page tokens from all admin responses.
