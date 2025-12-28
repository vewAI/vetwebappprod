# Antigravity Workflows

This directory contains workflows that Antigravity can execute.

## How to use
- Workflows are `.md` files in this directory.
- They must start with a YAML frontmatter:
  ```yaml
  ---
  description: [Short description of the workflow]
  ---
  ```
- You can trigger a workflow by its filename using a slash command. For example, `setup.md` can be triggered with `/setup`.
- Use `// turbo` above a step to allow Antigravity to run it automatically without asking for confirmation.

## Example
Create a file named `test.md`:
```markdown
---
description: Run all tests
---
// turbo
1. npm test
```
Then type `/test` in the chat.
