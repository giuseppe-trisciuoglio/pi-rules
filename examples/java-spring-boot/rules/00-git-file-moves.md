---
description: Preserve git history for file moves
globs: "**/*"
alwaysApply: true
---

# File Moves Use git mv

## Rule

- Use `git mv <source> <destination>` to move or rename files already tracked by Git.
- Do not use plain `mv` for tracked files.

## Exceptions

- `mv` is acceptable for untracked files.
- For moves across repositories, use `git mv` in the repository where the file is tracked.

## Motivation

`git mv` makes the rename/move intent explicit and makes history, blame, and review easier.