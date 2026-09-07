---
description: SOLID - Single Responsibility Principle for Java code
globs: "**/*.java"
alwaysApply: true
---

# SOLID — Single Responsibility Principle (SRP)

## Principle

A class, method, or module must have **only one reason to change**.

## Rules

- Each class must represent a clear, cohesive responsibility.
- Do not mix business logic, persistence, mapping, HTTP validation, and external integrations in the same class.
- Controllers handle the protocol/API and delegate.
- Services/use cases coordinate the use case.
- The domain contains business rules and invariants.
- Infrastructure adapters handle database, HTTP client, messaging, filesystem, or cache.

## Violation Signals

- A class changes for different reasons: API, DB, business rule, external format.
- Very long methods with unrelated sections.
- Classes with generic names like `Manager`, `Helper`, `Utils` that do many things.
- Tests are hard because many unrelated dependencies are needed.

## How to Fix

- Extract dedicated mappers for conversions between DTO/domain/entity.
- Extract policy/domain services for complex business rules.
- Extract adapters for external calls or persistence.
- Split long methods into private operations with intentional names, or into separate classes if they have autonomous responsibilities.