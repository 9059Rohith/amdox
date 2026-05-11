# ADR-001: Modular Monolith Architecture

**Status:** Accepted  
**Date:** 2026-05-08  
**Deciders:** Engineering Team  
**Context:** Amdox ERP System Architecture

## Context

We need to decide on the overall architecture for the Amdox AI-Powered Cloud ERP Suite. The primary options are:

1. **Microservices Architecture**: Decompose the system into independent services from day one
2. **Modular Monolith**: Build a well-structured monolith with clear module boundaries
3. **Hybrid Approach**: Start with a monolith, extract services as needed

## Decision

We will implement a **Modular Monolith** architecture with a clear extraction path to microservices.

### Core Principles

1. **Module Boundaries**: Each business domain (Finance, HR, Supply Chain, etc.) is a separate module with:
   - Dedicated folder structure
   - Clear public APIs (controllers, services)
   - Encapsulated data access (repositories)
   - Independent DTOs and validation

2. **Shared Infrastructure**: Common concerns handled at the application level:
   - Authentication & Authorization (Keycloak integration)
   - Database connections (Prisma)
   - Caching & Queuing (Redis + BullMQ)
   - Logging & Monitoring (OpenTelemetry)

3. **Service Extraction Readiness**:
   - Each module communicates through well-defined interfaces
   - Domain events for cross-module communication
   - Outbox pattern for eventual consistency
   - Database per module (logical separation via schemas)

## Rationale

### Why Modular Monolith?

1. **Development Velocity**
   - Faster initial development and iteration
   - Simplified debugging and testing
   - Single deployment unit reduces operational complexity
   - Shared code and utilities easily accessible

2. **Team Productivity**
   - Small team (initially) can focus on features, not infrastructure
   - Easier onboarding for new developers
   - Simplified local development environment

3. **Performance**
   - In-process communication (no network overhead)
   - Single database transaction for cross-module operations
   - Optimized query patterns (JOINs across modules)

4. **Cost Efficiency**
   - Lower infrastructure costs (single deployment)
   - Reduced DevOps overhead
   - Simplified monitoring and logging

### Microservices Extraction Path

When modules reach extraction threshold:
- **Technical indicators**: >100 req/sec, >2s P95 latency, memory issues
- **Organizational indicators**: >5 developers on module, frequent deployments
- **Business indicators**: Need for independent scaling, regulatory isolation

Extraction process:
1. Ensure module has clean public API
2. Replace in-process calls with HTTP/gRPC
3. Extract database schema to separate instance
4. Deploy as independent service with separate CI/CD
5. Monitor and validate

## Consequences

### Positive

- ✅ Faster time-to-market for MVP
- ✅ Lower operational complexity initially
- ✅ Easier to refactor and evolve architecture
- ✅ Single codebase simplifies code sharing
- ✅ Atomic transactions across modules
- ✅ Simplified testing (no distributed system issues)

### Negative

- ⚠️ Risk of tight coupling if boundaries not enforced
- ⚠️ Single point of failure (entire app goes down)
- ⚠️ Monolithic deployment (all-or-nothing releases)
- ⚠️ Cannot scale individual modules independently
- ⚠️ Eventually will require refactoring for scale

### Mitigations

1. **Enforce Module Boundaries**
   - ESLint rules to prevent cross-module imports
   - Architectural testing (ArchUnit equivalent)
   - Code review checklist for coupling

2. **Design for Distribution**
   - Use domain events (EventEmitter2 + outbox pattern)
   - Avoid direct module-to-module calls
   - Implement circuit breakers and retries

3. **Monitoring & Alerts**
   - Module-level metrics and dashboards
   - Performance budgets per module
   - Alerts for coupling violations

4. **Regular Architecture Reviews**
   - Quarterly assessment of module health
   - Extraction candidate identification
   - Refactoring sprints every 6 months

## Alternatives Considered

### 1. Microservices from Day One

**Pros:**
- Independent scaling from start
- Team autonomy and parallel development
- Technology diversity (polyglot)

**Cons:**
- High initial complexity and overhead
- Distributed system challenges (eventual consistency, partial failures)
- More expensive infrastructure
- Slower development velocity initially

**Verdict:** ❌ Rejected - Premature optimization given team size and uncertain scale requirements

### 2. Serverless Functions (FaaS)

**Pros:**
- Automatic scaling
- Pay-per-use pricing
- Minimal infrastructure management

**Cons:**
- Cold start latency issues
- Vendor lock-in
- Complex debugging
- Limited for long-running processes (ML training)

**Verdict:** ❌ Rejected - Not suitable for ERP with complex transactions and background jobs

### 3. Event-Driven Microservices

**Pros:**
- Loose coupling via events
- Excellent scalability
- Natural fit for audit logging

**Cons:**
- Eventual consistency complexity
- Hard to debug and test
- Requires mature event infrastructure

**Verdict:** 🔄 Deferred - Consider after extracting first service

## References

- [Shopify: Deconstructing the Monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)
- [Martin Fowler: MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- [Sam Newman: Monolith to Microservices](https://samnewman.io/books/monolith-to-microservices/)
- [Kelsey Hightower: Monolith vs Microservices](https://twitter.com/kelseyhightower/status/940259898331238402)

## Review Schedule

- **Next Review:** 2026-11-08 (6 months)
- **Criteria for Change:**
  - Team size >20 developers
  - Request volume >10k req/sec
  - Customer count >500 enterprises
  - Module coupling violations >10/month
