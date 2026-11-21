---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
---

# How

Explore the codebase to answer "how does X work?" questions.

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

## 1. Explain

Spawn one `pstack_spawn` child (`role: how-explainer`, `run_in_background: true`) that explores and explains in one pass. `how-explainer` has no overlay line, so the child runs on this conversation's route. Send no `model` or `effort`; follow [`../setup-pstack/references/spawn.md`](../setup-pstack/references/spawn.md).

Build the brief from [`references/explainer-prompt.md`](references/explainer-prompt.md), filled with the user's question. Tell the child it has read-only access and must not edit files.

## 2. Present

Present the child's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.
