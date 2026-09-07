---
description: Environment variables and secrets management
globs: "**/application*.yml,**/application*.yaml,**/application*.properties,**/.env*,**/*Properties.java"
alwaysApply: false
---

# Secrets and Environment Variables

## Security

- Do not commit real secrets: passwords, tokens, API keys, private certificates, production connection strings.
- Use template files (`.env.example`, `application-local.example.*`) with safe placeholders.
- Do not log secrets or sensitive configurations.
- In production, prefer the secret manager/parameter store of the cloud provider or platform.

## Application Configuration

- Centralize configurations in `application.*` files and typed `@ConfigurationProperties` classes.
- Validate required properties at startup with Bean Validation or explicit checks.
- Avoid insecure default values in non-local profiles.
- Use profiles (`local`, `test`, `staging`, `prod`) consistently.

## New Variable — Checklist

1. Add the property to the typed class/configuration.
2. Add validation and documentation of the meaning.
3. Update the template/example without real secrets.
4. Update docker compose, Helm, CI/CD, or documentation if the variable is required at runtime.
5. Verify the application starts with the local/test profile.

## Rotation

- Plan rotation for tokens, passwords, certificates, and API keys.
- In case of a leak, rotate the secret immediately and remove it from history according to the security procedure.