---
description: Generic Java and Spring Boot project structure rules
globs: "**/*.java,**/pom.xml,**/build.gradle,**/build.gradle.kts"
alwaysApply: true
---

# Java Project Structure

## General Structure

For Java/Spring Boot applications, organize code by domain or feature, keeping architectural layers separate:

```text
src/main/java/<base-package>/
  shared/                 # cross-cutting components and shared types
  <domain>/
    domain/               # entities, value objects, domain services, ports
    application/          # use cases, application DTOs, mappers, orchestration
    infrastructure/       # external adapters, persistence, messaging, technical config
    presentation/         # REST controllers, HTTP handlers, API DTOs if separate

src/main/resources/
  application.yml|properties
  db/migration/           # migrations if present

src/test/java/<base-package>/
  ...                     # tests mirroring the main structure
```

## Dependency Rules

- `domain` does not depend on Spring, JPA, HTTP, messaging, or external frameworks.
- `application` depends on the domain and on ports/interfaces, not on infrastructure details.
- `infrastructure` implements ports and contains technical integrations.
- `presentation` translates HTTP/API toward application use cases.
- Avoid cyclic dependencies between packages and domains.

## Naming

- Java packages are always lowercase.
- Classes in PascalCase; methods, fields, and variables in camelCase.
- Recommended suffixes: `Controller`, `UseCase`, `Service`, `Repository`, `Adapter`, `Mapper`, `Configuration`, `Properties`, `Dto`, `Request`, `Response`.
- Name classes and methods using domain vocabulary, not generic technical details.

## General Rules

- Keep packages cohesive: code of a domain close to the domain itself.
- Put genuinely cross-cutting utilities in `shared`; do not use it as a generic dumping ground.
- Prefer interfaces in the inner layer and implementations in the outer layer.
- Do not modify manually generated code; modify the generation schema/source instead.