---
description: Java build tool and dependency management rules
globs: "**/pom.xml,**/build.gradle,**/build.gradle.kts,**/mvnw,**/gradlew"
alwaysApply: false
---

# Build Tools and Dependencies

## Maven / Gradle

- Use the project's wrapper (`./mvnw` or `./gradlew`) instead of global installations.
- Do not mix Maven and Gradle in the same module unless the architecture explicitly requires it.
- Maintain lock/dependency verification if the project uses them.
- Run at least the relevant compile/test after changes to code or dependencies.

## Dependencies

- Add new dependencies only when necessary and justified.
- Prefer mature, maintained libraries compatible with the Java/Spring version in use.
- Avoid duplicate or overlapping dependencies for the same purpose.
- Do not introduce hardcoded versions if the project uses dependency management/BOM.

## Modules

- In multi-module projects, respect module boundaries.
- An inner module must not depend on external adapters if it breaks the architecture.
- Dependencies between modules must follow the direction established by the layers.

## Typical Commands

```bash
./mvnw clean verify
./mvnw test
./mvnw -pl <module> test

./gradlew clean build
./gradlew test
./gradlew :<module>:test
```