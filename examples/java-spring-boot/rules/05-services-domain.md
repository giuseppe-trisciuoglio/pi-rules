---
description: Application services, use cases, and domain model rules
globs: "**/*.java"
alwaysApply: true
---

# Services, Use Cases, and Domain

## Application Service / Use Case

- Every use case must represent a clear application action.
- Always declare the return type and use explicit DTOs/commands/queries at application boundaries.
- Validate business preconditions at the application or domain layer, not in controllers.
- Coordinate ports, repositories, transactions, and event publishing without containing infrastructure details.

## Domain Model

- Entities and value objects must protect their own invariants.
- State transitions must be intentional methods (`approve`, `cancel`, `complete`), not free setters.
- `equals`/`hashCode` of entities must be based on stable identity, not on every mutable field.
- Value objects must be immutable and validate input in the constructor/factory.

## Validation

- Structural validation: DTOs/requests through Bean Validation.
- Semantic/business validation: service/use case/domain.
- Do not duplicate in the service checks already guaranteed by Bean Validation, unless explicitly justified.

## Business Errors

- Use specific domain/application exceptions (`ResourceNotFoundException`, `InvalidStateTransitionException`, etc.).
- Exceptions must not depend on HTTP in the domain.
- Translation to HTTP status codes happens in the presentation/advice layer.

## Helpers and Mappers

- Extract helpers only when they reduce real duplication and have a clear domain name.
- Keep mappers pure and testable.
- Do not hide DB or network calls inside seemingly simple mappers.