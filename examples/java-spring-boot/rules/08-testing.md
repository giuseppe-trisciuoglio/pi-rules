---
description: Java testing conventions
globs: "**/*Test.java,**/*IT.java,**/pom.xml,**/build.gradle,**/build.gradle.kts"
alwaysApply: false
---

# Testing

## Test Types

- Unit tests: pure logic, domain, mappers, and services with mocked dependencies.
- Slice tests: controllers, repositories, or isolated Spring components (`@WebMvcTest`, `@DataJpaTest`, etc.).
- Integration tests: real flows with Spring context and external dependencies via Testcontainers or equivalents.

## Conventions

- Tests must mirror the package of the tested class.
- Recommended naming: `XTest` for unit/slice, `XIT` or `XIntegrationTest` for integration tests if the project distinguishes them.
- Use descriptive test names: `shouldReturnNotFoundWhenResourceDoesNotExist`.
- Arrange / Act / Assert structure.

## Database and External Dependencies

- Use Testcontainers for databases, brokers, and external services when real integration is needed.
- Do not depend on already running local services for automated tests.
- Isolate data between tests with cleanup, transaction rollback, or dedicated fixtures.
- Verify writes by reading the persisted state, not just the return value.

## Mocking

- Mock external providers, HTTP clients, clocks, and id generators when they make tests deterministic.
- Do not mock the domain: test the real rules.
- Avoid overly deep mocks that replicate the implementation instead of the behavior.

## Quality

- Every bug fix should include a test that fails without the fix when practical.
- Every new business logic must have automated coverage.
- Run the relevant tests before declaring work complete.