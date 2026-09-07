---
description: REST controller conventions for Java Spring applications
globs: "**/*Controller.java"
alwaysApply: false
---

# REST Controllers

## General Rules

- Use `@RestController` and kebab-case/plural paths when consistent with the API.
- Keep controllers thin: no business logic, complex queries, or manual transactions.
- Use request/response DTOs; do not expose JPA entities or domain objects directly.
- Declare explicit status codes with `ResponseEntity` or `@ResponseStatus` when not using defaults.
- Inject use cases/services through constructor injection.

## Parameters

- `@RequestBody` must use DTOs validated with `@Valid`.
- `@PathVariable` and `@RequestParam` must have clear names and specific types.
- For complex filters, use a dedicated query DTO instead of long parameter lists.
- Do not accept `Map<String, Object>` or `Object` as a body except for deliberately dynamic endpoints.

## Error Handling

- Do not try/catch in controllers for globally handled errors.
- Use specific application exceptions and a `@RestControllerAdvice` to map them to HTTP responses.
- For public APIs, return a stable error format (e.g., RFC 7807 Problem Details).

## Security

- Every non-public endpoint must be protected by the project's security configuration.
- Do not trust user ids, tenant ids, or roles received from the client: derive them from the authenticated context.
- Do not log sensitive bodies.

## Documentation

- Document endpoints, requests, responses, and errors with OpenAPI if the project exposes Swagger/OpenAPI.
- Keep examples and status codes synchronized with the actual behavior.