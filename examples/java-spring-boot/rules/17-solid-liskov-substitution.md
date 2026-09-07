---
description: SOLID - Liskov Substitution Principle for Java code
globs: "**/*.java"
alwaysApply: true
---

# SOLID — Liskov Substitution Principle (LSP)

## Principle

A derived class or implementation must be able to replace the base type **without altering program correctness**.

## Rules

- Every implementation of an interface must respect the expected contract.
- Do not strengthen preconditions compared to the base type.
- Do not weaken postconditions promised by the base type.
- Do not throw unexpected exceptions relative to the documented contract.
- Avoid "fake" implementations that leave unsupported methods.

## Violation Signals

- Methods implemented with `throw new UnsupportedOperationException()`.
- Client code that checks `instanceof` to handle special subtypes.
- Implementations of the same interface with incompatible semantics.
- Subclasses that disable inherited behaviors.

## How to Fix

- Make the interface smaller and more specific.
- Separate different contracts instead of forcing a single hierarchy.
- Prefer composition over inheritance when behaviors are not truly substitutable.
- Document invariants, preconditions, postconditions, and exceptions of the contract.

## Practical Rule Example

If a method accepts `RepositoryPort`, it must be able to use any implementation of `RepositoryPort` without knowing whether behind it is a database, a mock, a cache, or a remote client.