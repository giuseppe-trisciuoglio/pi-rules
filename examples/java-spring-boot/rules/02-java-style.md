---
description: Java coding style and language conventions
globs: "**/*.java"
alwaysApply: true
---

# Java Style

## Version and Language

- Use features of the Java version configured by the project, without introducing incompatibilities.
- Prefer `record` for simple immutable DTOs and value objects.
- Use `final` for immutable fields and injected dependencies.
- Avoid `var` when it reduces readability or hides important types.

## Null Safety

- Do not return `null` from public methods when a clear alternative exists.
- Use `Optional<T>` for explicit absence in return types, not for entity/DTO fields.
- Validate public inputs and domain invariants at the proper boundary.

## Collections

- Return empty collections instead of `null`.
- Expose immutable lists when they must not be modified (`List.copyOf`, `Collections.unmodifiableList`).
- Avoid hidden side effects in complex streams; favor readability.

## Exceptions

- Use specific, meaningful exceptions.
- Do not use generic `RuntimeException` for business errors.
- Do not catch exceptions just to ignore them; log or rethrow with useful context.

## Logging

- Use the framework logger (`SLF4J`/`LoggerFactory`, or Lombok `@Slf4j` if already adopted).
- Do not use `System.out.println` or `printStackTrace` in application code.
- Do not log passwords, tokens, API keys, connection strings, or unnecessary personal data.

## Lombok

- Use Lombok only if already adopted by the project.
- Avoid `@Data` on entities and domain classes: it generates overly broad methods and can break equals/hashCode.
- Prefer explicit annotations (`@Getter`, `@Builder`, `@RequiredArgsConstructor`) when they improve readability.