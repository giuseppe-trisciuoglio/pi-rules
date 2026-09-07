---
description: SOLID - Open Closed Principle for Java code
globs: "**/*.java"
alwaysApply: true
---

# SOLID — Open/Closed Principle (OCP)

## Principle

Code must be **open to extension** but **closed to modification**.

## Rules

- Add new behaviors by extending through interfaces, strategies, handlers, or policies when the domain requires it.
- Avoid long `if/else` or `switch` chains on types, providers, states, or operations when you expect new variants.
- Use polymorphism, strategy pattern, or handler registries for evolving variants.
- Keep public contracts stable and change the implementation behind interfaces when possible.

## Violation Signals

- Each new variant requires changes to the same central method.
- Repeated `switch` on the same enums in different classes.
- New providers/strategies force touching unrelated code.
- Existing tests often break when adding new behavior.

## How to Fix

- Introduce a common interface, e.g., `PaymentProvider`, `NotificationSender`, `ImportHandler`.
- Implement one class per variant.
- Use dependency injection to gather available implementations.
- Move strategy selection to a dedicated factory or registry.

## Note

Do not introduce premature abstractions: apply OCP when there are real or reasonably expected variants.