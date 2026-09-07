---
description: DTO and Bean Validation conventions
globs: "**/*Dto.java,**/*Request.java,**/*Response.java"
alwaysApply: false
---

# DTO and Bean Validation

## General Rules

- Use dedicated DTOs for API input and output.
- Prefer `record` for immutable DTOs when compatible with the framework.
- Do not reuse JPA entities as REST DTOs.
- Separate request and response when they have different purposes.

## Naming

- Incoming requests: `CreateXRequest`, `UpdateXRequest`, `SearchXRequest`, or `XCommand` when used internally.
- Outgoing responses: `XResponse`, `XDetailsResponse`, `PaginatedXResponse`.
- Internal DTOs: `XDto` only when they do not directly represent an HTTP contract.

## Bean Validation

- Every field received from the client must have consistent constraints: `@NotNull`, `@NotBlank`, `@Size`, `@Email`, `@Pattern`, `@Positive`, `@Valid`, etc.
- For nested objects, always use `@Valid` on the containing field.
- For nested lists, validate both the list and its elements when necessary.
- Use validation groups only when they actually simplify create/update scenarios; otherwise prefer separate DTOs.

## Dates, Numbers, and Enums

- Use `Instant`, `LocalDate`, `LocalDateTime`, `OffsetDateTime` consistently with the API contract.
- For money or decimal values, use `BigDecimal`, not `double`/`float`.
- For states and categories, use typed enums; handle unknown values with clear errors.

## Error Messages

- Keep user-facing messages clear and consistent.
- For public APIs, avoid exposing internal details or stack traces.
- Centralize error formatting in the global exception handler.