# AI Customer Support CMS — Codex Instructions

## Technology
- Angular 20, TypeScript, SCSS.
- Standalone components and Angular Reactive Forms.
- Angular Material 20 for UI components.
- Node.js Express backend with MySQL.

## Project Context
- Frontend: `ai-customer-support-cms/`
- Backend: `ai-customer-support/`
- Database schema: `docs/ai_customer_support.sql`

Read the database schema and inspect existing backend APIs before implementing features.

## Authentication and Authorization

The platform requires two types of users:

1. **Super Admin (PLANNED — NOT IMPLEMENTED)**
   - Platform-wide access to all businesses and their data.
   - Can manage businesses and business administrators.
   - The database role and authentication logic have not been implemented yet.
   - Do not assume the required database columns or backend endpoints exist.

2. **Business Admin**
   - Can access only businesses assigned to their account.
   - Existing database tables include `users` and `business_admins`.
   - Verify the actual schema before assuming authentication fields or permissions exist.

### Authentication Rules
- Provide separate login interfaces for Super Admin and Business Admin.
- Use a shared authentication architecture where appropriate.
- Business ID must come from the authenticated server-side session.
- Never trust client-supplied business IDs for authorization.
- Do not implement fake authentication or hardcoded login credentials.
- If backend authentication APIs are unavailable, create the UI structure and document the missing API contracts.

## Development Rules
- Use reusable Angular components and services.
- Use typed interfaces for API responses.
- Implement loading, empty, and error states.
- Do not hardcode credentials, tokens, or sample business data into production components.
- Never expose encrypted Facebook Page tokens or other secrets.
- Do not modify backend files or database schema without explicit approval.
- Do not read or modify `.env` files.
- Keep Angular at version 20.

## Workflow
1. Inspect existing code and database schema.
2. Identify implemented features versus planned features.
3. Explain the implementation plan.
4. Implement one feature at a time.
5. Run the Angular build and resolve compilation errors.
6. Summarize modified files and missing backend endpoints.

## Initial Task
Build the Angular application shell with:
- Responsive sidebar and header.
- Separate Super Admin and Business Admin login pages.
- Separate dashboard layouts.
- Role-aware navigation structure.
- Reusable UI components.

Do not implement real authentication until the backend authentication API and Super Admin database design are finalized.