---
description: Persistence, repositories, migrations, and transaction rules
globs: "**/*.java,**/db/migration/**,**/resources/**/*.sql"
alwaysApply: false
---

# Persistence and Transactions

## Repository

- Repositories/adapters belong to the infrastructure layer.
- Expose to the application/domain layer domain-oriented ports, not technical queries.
- Do not let `EntityManager`, query builders, or ORM details leak out of infrastructure.
- Avoid N+1 queries: use targeted fetches, projections, or dedicated queries when needed.

## Entity Persistence

- Do not expose JPA entities directly from REST APIs.
- Keep constructors and factories consistent with invariants.
- Avoid indiscriminate public setters on entities with business rules.
- Do not put HTTP logic or API mapping inside persistence entities.

## Database Migrations

- Use the migration tool chosen by the project (Flyway, Liquibase, or equivalent).
- Every schema change must have a versioned, repeatable migration in CI.
- Do not modify migrations already applied in shared environments; add a new one.
- Migrations must be backward-compatible when required by the deployment process.

## Transactions

- Operations that change multiple aggregates/tables must be atomic.
- Use read-only transactions for complex queries when appropriate.
- Do not include calls to external providers inside DB transactions if you can avoid it.
- Handle unique constraints and concurrency with DB constraints, locks, or retries where needed.

## Query and Performance

- Always paginate potentially large lists.
- Add indexes for frequently used filters/sorts.
- Verify generated queries when you change mapping, fetch, or important joins.