# ADR-003: Row-Level Security for Multi-Tenancy

**Date:** 2026-04-01  
**Status:** Accepted  
**Deciders:** Backend Lead, Security Lead

## Context

The ERP serves multiple tenants from a single Postgres database (shared schema, shared database). We need to guarantee that Tenant A can never access Tenant B's data — even if there is a bug in application-layer filtering. The alternatives are:

1. **Separate databases per tenant** — complete isolation but operationally expensive; schema migrations must run N times.
2. **Shared database, separate schemas** — less expensive but still N migrations; connection pooling is complex.
3. **Shared database, shared schema + application-layer tenantId filter** — simplest operationally, but relies solely on developer discipline.
4. **Shared database, shared schema + Postgres Row-Level Security (RLS)** — database enforces isolation as a second line of defense.

## Decision

We use **Option 4**: all tables include a `tenantId UUID NOT NULL` column, and the Prisma query layer always injects `WHERE tenant_id = $tenantId`. Additionally, Postgres RLS policies are defined (in `init-db.sh`) as a belt-and-suspenders defense.

The `TenantContextMiddleware` extracts `x-tenant-id` from the JWT and attaches it to every request. The `DatabaseModule` creates a tenant-scoped Prisma client with an `$extends` query extension that injects the filter automatically — it is never optional.

## Consequences

**Positive:**
- Impossible to return cross-tenant data even with a buggy query.
- Audit queries can trivially scope to a tenant.
- Compliant with SOC 2 CC6.1 (logical access controls) and GDPR Art. 25 (data protection by design).

**Negative:**
- Slightly more complex Prisma client setup (scoped extension per request).
- RLS adds marginal overhead (~1-2%) on Postgres; acceptable at our scale.
- Onboarding new entities requires remembering to add `tenantId` and the RLS policy.

## References

- Prisma client extensions: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions
- Postgres RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- SOC 2 CC6.1 mapping: internal security runbook
