# ADR-004: BullMQ + Redis for Async Job Processing

**Date:** 2026-04-02  
**Status:** Accepted  
**Deciders:** Backend Lead, Platform Lead

## Context

Multiple ERP workflows require asynchronous, reliable processing:
- Payroll batch computation (potentially minutes for large tenants)
- Email/SMS/webhook notification delivery
- Report PDF/Excel generation
- Demand forecasting model retraining (weekly cron)
- Inventory reorder PO draft creation

Alternatives evaluated:

| Option | Pros | Cons |
|--------|------|------|
| **BullMQ + Redis** | Mature, NestJS-native `@nestjs/bull`, Bull Board UI, DLQ support | Redis dependency |
| **AWS SQS** | Fully managed, no infra | Vendor lock-in; harder local dev |
| **RabbitMQ** | AMQP, rich routing | More complex setup; less NestJS integration |
| **pg_cron + Postgres** | No extra infra | No retry, no concurrency control, no UI |

## Decision

We adopt **BullMQ** (via `@nestjs/bull`) backed by Redis 8. Queues:
- `notifications` — in-app SSE dispatch
- `email` — SES email delivery  
- `webhook` — HMAC-signed HTTP delivery
- `payroll` — batch payroll computation
- `reports` — PDF/Excel generation + email
- `reorder` — inventory reorder automation

**Dead-letter queue:** Failed jobs after 3 retries are moved to a `*-failed` queue. Bull Board UI is mounted at `/admin/queues` (admin-only, RBAC-guarded).

**Weekly retraining cron:** BullMQ Redis cron syntax `repeat: { cron: '0 2 * * 0' }` triggers ML model retraining every Sunday at 02:00 UTC.

## Consequences

**Positive:**
- Reliable at-least-once delivery with configurable retry backoff.
- Full observability via Bull Board (job counts, processing times, errors).
- Redis already in the stack for caching — no new infrastructure.
- DLQ prevents silent failures; alerts on dead-letter growth.

**Negative:**
- Redis is a new SPOF; mitigated by ElastiCache Multi-AZ in production.
- Workers must be idempotent (duplicate execution on crash recovery).

## References

- BullMQ docs: https://docs.bullmq.io
- @nestjs/bull: https://docs.nestjs.com/techniques/queues
- Bull Board: https://github.com/felixmosh/bull-board
