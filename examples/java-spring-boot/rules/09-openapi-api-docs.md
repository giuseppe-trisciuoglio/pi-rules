---
description: OpenAPI and API documentation rules
globs: "**/*Controller.java,**/*Request.java,**/*Response.java,**/openapi/**/*"
alwaysApply: false
---

# OpenAPI and API Documentation

## General Rules

- Every public endpoint must be documented in a way consistent with the actual behavior.
- Document summary, description, request, success response, and main errors.
- Keep status codes and error schemas synchronized with the global exception handler.
- Do not document fields not supported by the implementation.

## Schemas

- Use explicit request/response DTOs to generate stable schemas.
- Add examples when they help external clients or machine-to-machine integrations.
- For enums, document allowed values and their meaning.
- For pagination, document metadata (`page`, `size`, `total`, etc.) according to the project standard.

## Errors

- For public or external APIs, prefer a standard error format (e.g., RFC 7807 Problem Details).
- Do not expose stack traces or infrastructure details.
- Document 400, 401, 403, 404, 409, and 500 when applicable.

## Generated Contracts

- If the project generates clients/servers from OpenAPI, do not manually modify generated code.
- Update the source spec first, then regenerate the artifacts.
- Check for breaking changes in contracts before changing fields, paths, or status codes.