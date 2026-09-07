---
description: Generic security rules for Java backend applications
globs: "**/*.java,**/application*.yml,**/application*.properties"
alwaysApply: true
---

# Security

## Input and Output

- Validate every input coming from clients, queues, files, or external providers.
- Do not expose internal details, stack traces, or DB messages in API responses.
- Apply output encoding/sanitization when producing rendered content or exports.

## Authentication and Authorization

- Every non-public endpoint must require authentication.
- Authorization must be checked on the server side, not just on the client side.
- Apply the principle of least privilege to roles, scopes, tokens, and credentials.
- Do not trust roles or tenant ids passed in the payload from the client.

## Sensitive Data

- Do not log secrets, tokens, passwords, cookies, Authorization headers, or unnecessary personal data.
- Mask sensitive data in logs and errors.
- Use HTTPS/TLS for external communications and verify certificates unless explicit local cases.

## External Integrations

- Configure timeout, retry, and circuit breaker where appropriate.
- Handle rate limits and transient errors without indefinitely blocking threads or transactions.
- Validate and normalize external responses before inserting them into the domain.

## Dependency Security

- Keep dependencies up to date and check for CVEs when adding libraries.
- Do not disable security checks to make tests/build pass without documented justification.