---
description: Spring Boot layering, dependency injection, and component rules
globs: "**/*.java"
alwaysApply: true
---

# Spring Boot Layers

## General Rules

- Controllers must be thin: they validate/transform HTTP and delegate to use cases or services.
- Business logic lives in application/domain services or use cases, not in controllers.
- The domain must remain framework-free when following DDD/hexagonal architecture.
- Infrastructure contains technical implementations: DB repositories, HTTP clients, queues, filesystem, cache.

## Dependency Injection

- Prefer constructor injection.
- Avoid field injection (`@Autowired` on fields).
- Make dependencies `private final`.
- Inject interfaces/ports when you want to decouple application and infrastructure.

## Configuration

- Use typed `@ConfigurationProperties` classes for non-trivial configuration.
- Validate properties with Bean Validation when needed.
- Avoid scattered access to `System.getenv()` or `System.getProperty()` in business code.

## Transactions

- Place `@Transactional` on the application boundary that coordinates the state change.
- Do not open transactions in controllers.
- For read-only operations, use `@Transactional(readOnly = true)` when appropriate.
- Keep transactions short: avoid slow network calls inside DB transactions when possible.

## Async, Messaging, and Scheduler

- Isolate consumers/listeners/schedulers in infrastructure adapters.
- Listeners must delegate to idempotent use cases when possible.
- Handle retry, dead-letter, and timeout explicitly for external integrations.