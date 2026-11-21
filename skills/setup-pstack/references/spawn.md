# pstack_spawn

Canonical DSH spawn for this port. Playbooks follow this file. Do not send Cursor `Task` fields or grok `task` fields.

## Call

```text
pstack_spawn
  description: <3-5 words>
  prompt: <complete brief>
  role: <pstack role key>
  run_in_background: true
  route_index: <optional, panel roles only>
```

Allowed fields: `description`, `prompt`, `role`, `run_in_background`, `route_index`.

Forbidden on this call: `model`, `provider`, `reasoning_effort`, `thinking`, `isolation`, `subagent_type`, `environment`, `readonly`, `resume_from`.

Route and effort come from `$DSH_HOME/pstack-dsh.json` when the plugin detail editor mapped that role to a DSH-listed route. Missing overlay, `inherit: true`, or empty `routes`: inherit this conversation. Usable without setup.

## Fallback

If `pstack_spawn` is not registered, call official `subagent` with only `description`, `prompt`, `run_in_background`. That child inherits the parent. You lose per-role overlay.

## Wait and cancel

- Continuable (shipped `spawn` + `subagent` `backgroundMode: continuable`): start returns a subagent id. A settlement notice arrives when the child ends. `send_message` gives it more work. `interrupt_agent` stops the current turn.
- One-shot background: collect with `job_output`, stop with `job_kill`.

Do not poll `list_agents` for completion.

## Isolation

DSH `subagent` has no isolation field. Children share the parent cwd (`packages/subagent/subagent-spawn-in-process/README.md`). When workers must not share a tree, the **parent** runs `git worktree add` (or a unique directory) and puts that path in each prompt.

## Roles

Nine upstream lines can hold a model mapping:

| Role | Used by |
|---|---|
| `feature, refactoring` | feature and refactoring code delegates |
| `bug-fix` | bug fix delegate |
| `perf-issue` | performance delegate |
| `hillclimb` | hillclimb delegate |
| `judgment and prose` | hardest and judgment-heavy work |
| `arena runners` | `/arena` candidates, `/architect` design candidates |
| `arena cross-judge pool` | `/arena` cross-judge |
| `swarm workers` | `/swarm` workers, and verification |
| `interrogate reviewers` | `/interrogate` reviewers |

Any other role name a skill uses, such as `how-explorer`, `how-explainer`, `why-investigators`, `why-synthesizer`, `reflect-judgment`, `poteto-agent`, or `comment-sicko`, has no line. Those children run on this conversation's route. The retired names (`hardest-tasks`, `architect-runners`, `how-critics`, …) are dropped when the overlay is read.

Panel roles (`arena runners`, `arena cross-judge pool`, `swarm workers`, `interrogate reviewers`): call `pstack_overlay_read`. If the role inherits, spawn N independent children all inheriting (same route, separate reads). If the role has routes, one `pstack_spawn` per route with `route_index` 0..n-1. Do not invent slugs to fake a panel.

## Todo and questions

- `todo_write({ todos: [{ content, status }] })` replaces the whole list. Status is `pending`, `in_progress`, or `completed`. No `id`, `merge`, or `cancelled`.
- Product or preference questions: `ask_user_question`.
