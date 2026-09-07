---
description: SOLID - Dependency Inversion Principle for Java and Spring code
globs: "**/*.java"
alwaysApply: true
---

# SOLID — Dependency Inversion Principle (DIP)

## Principle

High-level modules must not depend on low-level modules: both must depend on abstractions.

## Rules

- The domain and application layer depend on interfaces/ports, not on concrete adapters.
- Technical implementations live in the infrastructure layer.
- Use constructor injection to provide concrete implementations at runtime.
- Do not instantiate HTTP clients, concrete repositories, or external adapters directly inside use cases/domain services.
- Avoid framework dependencies in the domain.

## Violation Signals

- A use case creates objects with `new SomeHttpClient()` or `new JpaRepositoryAdapter()`.
- The domain imports Spring, JPA, HTTP, messaging, or cloud library classes.
- Changing database/provider requires changes to business logic.
- Business logic tests require a full Spring context or real infrastructure.

## How to Fix

- Define a port in the inner layer, e.g., `UserRepositoryPort`, `EmailSenderPort`, `PaymentGatewayPort`.
- Implement the port in the infrastructure layer.
- Inject the port into the service/use case through constructor injection.
- Configure the binding with Spring using `@Component`, `@Service`, `@Configuration`, or explicit beans.

## Benefits

- More testable business logic.
- Replaceable infrastructure.
- Clearer architectural boundaries.
- Less coupling between domain and technical details.