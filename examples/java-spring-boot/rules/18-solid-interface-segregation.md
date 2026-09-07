---
description: SOLID - Interface Segregation Principle for Java code
globs: "**/*.java"
alwaysApply: true
---

# SOLID — Interface Segregation Principle (ISP)

## Principle

Clients must not depend on methods they do not use.

## Rules

- Prefer small, cohesive, use-case-oriented interfaces.
- Do not create "fat" interfaces with many unrelated operations.
- If an implementation cannot support all methods, the interface is probably too broad.
- Separate read and write ports when they have different clients or responsibilities.
- Define ports from the perspective of the consuming layer, not the infrastructure that implements them.

## Violation Signals

- Implementations with empty methods or `UnsupportedOperationException`.
- Tests forced to mock many unused methods.
- Interfaces generically named `Service`, `Manager`, `Client` with too many responsibilities.
- Changing a method forces recompiling or modifying unrelated classes.

## How to Fix

- Split large interfaces into specific contracts: `UserReader`, `UserWriter`, `UserNotifier`.
- Create ports for individual use cases when useful.
- Keep DTOs and contract types minimal.
- Avoid exposing generic technical APIs if the domain requires more intentional operations.