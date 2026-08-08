---
description: Prevent direct commits and pushes to git
globs: "**/*"
alwaysApply: true
priority: 00
---

# No Direct Git Commits and Pushes

## Rule

- **NEVER run `git commit` or `git push` autonomously.**
- Always ask the human to perform commits and pushes.
- Inform the user about the changes ready to be committed.

## Rationale

Direct commits and pushes bypass human review and can introduce errors into the
shared remote repository. Human oversight is essential for code quality and
repository integrity.

## Workflow

1. After completing code changes, tell the user the changes are ready.
2. List the modified files.
3. Wait for the user to explicitly approve and execute the commit/push.
4. Offer a clear commit message if asked.
