---
description: Docker and local environment conventions
globs: "**/Dockerfile,**/docker-compose*.yml,**/docker-compose*.yaml,**/.dockerignore"
alwaysApply: false
---

# Docker and Local Environment

## Dockerfile

- Use official, versioned base images.
- Prefer multi-stage builds for Java applications: build with Maven/Gradle, runtime with minimal JRE.
- Do not copy secrets into the image.
- Use `.dockerignore` to exclude target/build, cache, local files, and secrets.
- Run the app as a non-root user when possible.

## Java Runtime

- Align the JDK/JRE version with the version configured by the project.
- Specify heap/memory when needed through runtime variables (`JAVA_OPTS`, `JAVA_TOOL_OPTIONS`).
- Expose only the necessary ports.

## Local docker-compose

- Use environment variables for ports, local credentials, and database names.
- Use named volumes for persistent database data.
- Avoid bind mounts for DB data unless specifically needed.
- Keep local services reproducible: database, broker, provider stubs, cache.

## Checklist

1. Image build succeeded.
2. Container startup verified locally.
3. Healthcheck present when useful.
4. No secrets included in layers or committed variables.
5. Documentation updated if ports, profiles, or required variables change.