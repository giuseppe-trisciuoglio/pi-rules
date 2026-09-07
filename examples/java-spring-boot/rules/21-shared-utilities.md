---
description: Rules for shared utility classes and methods
globs: "**/*.java"
alwaysApply: true
---

# Shared Utilities

## Principle

Shared utility classes must be few, cohesive, reusable, and placed in a `shared` package or equivalent. Before creating a new one, always check whether a suitable utility already exists.

## Mandatory Rule

Before creating a new utility class or utility method:

1. Search the `shared` package and common packages of the project.
2. Verify whether a class with similar responsibility already exists.
3. Verify whether a method that does exactly or almost what you need already exists.
4. If one exists, reuse or extend it consistently.
5. Create a new utility only if there is no existing suitable placement.

## Where to Search

Check first packages like:

```text
shared/
shared/util/
shared/utils/
shared/common/
shared/support/
```

or the equivalent defined by the project structure.

## Creation Rules

- Utilities must have a clear, specific responsibility.
- Avoid generic classes like `CommonUtils`, `GenericUtils`, `Helper`, `MiscUtils`.
- Prefer explicit names: `DateTimeUtils`, `StringSanitizer`, `MoneyUtils`, `ValidationUtils`.
- Methods must be `static` only if they are pure and require no state.
- Utilities must not depend on Spring components, repositories, HTTP clients, or runtime configurations.
- If state, dependencies, or configuration are needed, create a service/component, not a static utility.

## Constructor

Static utility classes must prevent instantiation:

```java
public final class DateTimeUtils {

    private DateTimeUtils() {
        throw new UnsupportedOperationException("Utility class");
    }

    public static boolean isPast(Instant instant) {
        return instant.isBefore(Instant.now());
    }
}
```

If the project uses Lombok, this is acceptable:

```java
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class DateTimeUtils {
    // static methods
}
```

## When NOT to Create a Utility

Do not create a utility when:

- The logic belongs to the domain: put it in an entity, value object, or domain service.
- The logic requires injected dependencies: create a service.
- The method is used only once and does not improve readability.
- The method hides a business rule that should have a domain name.
- A standard Java library or framework already does the same thing.

## Evolution of Existing Utilities

When adding a method to an existing utility:

- Stay consistent with the class's responsibility, naming, and style.
- Do not turn a specific class into a generic container.
- Add unit tests for the new behavior.
- Verify the change does not break existing callers.

## Checklist

Before creating or modifying utilities:

1. Did I search existing utilities/methods in the `shared` package?
2. Does the method not already exist in the Java standard library or an existing dependency?
3. Is the logic really technical/shared and not domain?
4. Is the class name specific and consistent?
5. Is the method pure, testable, and without hidden side effects?
6. Did I add or update unit tests?