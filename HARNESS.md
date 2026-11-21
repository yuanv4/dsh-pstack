# pstack in DeepSeek Harness

This file is the harness map for this port. Read it once when you change a skill or a tool; the skills themselves already speak DSH, so a normal session does not need it.

Upstream source: `cursor/plugins`, `pstack/` subtree, commit [`792440e8`](https://github.com/cursor/plugins/commit/792440e8a560a4a3f63748cdee70491ecd412982) (2026-11-21). Skills were synced from that commit. Re-sync by diffing `pstack/skills/` against `skills/` here and re-applying the mappings below, never by copying Cursor names in.

## Tools

| Upstream (Cursor) | DSH |
| --- | --- |
| `Task` subagent | `pstack_spawn`, then read the settlement notice |
| `AskQuestion` | `ask_user_question` |
| Open a todolist, or copy steps into the todolist tool | `todo_write` |
| `Grep`, `Glob` | `grep`, `glob` |
| Run another pstack skill | the `skill` tool, then follow the returned body |
| `/loop` | a background job or `create_goal`, not a built-in loop |
| A built-in PR tool | `gh` through `pwsh` |

## Subagent fields

| Upstream (Cursor) | DSH |
| --- | --- |
| `subagent_type` | `role` |
| `model:`, and the per-call reasoning level | nothing on the call. A role's model and effort come from `$DSH_HOME/pstack-dsh.json` only |
| `readonly: true` | say "do not edit files" in the brief, then check `git status` yourself |
| `readonly: false` | default |
| `environment: "cloud"` | create a worktree in the parent and put its path in the brief |
| `run_in_background: true` | `run_in_background: true` |
| `resume` | `send_message` to the settled child |
| `file_attachments` | list the paths in the brief |

`pstack_spawn` accepts only `description`, `prompt`, `role`, `run_in_background`, and `route_index`. A call that sends `model` or an effort field is a porting bug.

## Models

Upstream writes one line per role into a rules file and passes the model on every call. DSH's `subagent` has no per-call model, so the mapping lives in `$DSH_HOME/pstack-dsh.json` instead, and the editor writes it.

The mapped roles are the nine lines from upstream `setup-pstack`:

`feature, refactoring` · `bug-fix` · `perf-issue` · `hillclimb` · `judgment and prose` · `arena runners` · `arena cross-judge pool` · `swarm workers` · `interrogate reviewers`

A role the file does not name, such as `how-explainer`, `why-investigators`, `reflect-judgment`, or `poteto-agent`, runs on the parent conversation's route. That is the DSH equivalent of upstream sending no model.

Consequence to keep in mind when editing skills: upstream can raise one delegate's effort for one task. This port cannot. Effort is a property of the role, not of the call.

## Paths

| Upstream (Cursor) | DSH |
| --- | --- |
| `pstack/skills/` in the plugin | `skills/` in this package, served by the plugin |
| `.cursor/skills/`, `~/.cursor/skills/` | `<workspace>/skills/`, `~/.dsh/skills/` |
| `~/.cursor/rules/pstack-models.mdc` | `$DSH_HOME/pstack-dsh.json` |
| `~/.cursor/projects/<slug>/agent-transcripts/` | `$DSH_HOME/sessions/<workspace-slug>/<session>/session.v4.jsonl.zstd` |

## Skills

A skill's frontmatter decides how it is reached. The port keeps `how` and `why` model-invocable, because `poteto-mode`'s non-negotiables tell the model to route there itself; upstream marks them user-only. `architect`, `reflect`, `arena`, `swarm`, `interrogate`, and the playbooks stay user-invoked, as upstream has them.

## Skipped in DSH

DSH has no Cursor Automations, Bugbot, cloud agents, or `cursor-team-kit` skills. When a step needs one, write one line, `Skipped in DSH: <step>. <reason>.`, and continue to the next step. Do not stop, ask, or retry. When a later step needs what the skipped one produced, leave a placeholder and name it in the line.

## What this port drops

| Upstream field | Why |
| --- | --- |
| `Task.model`, Cursor panel slugs | DSH `subagent` has no per-call model |
| `Task.subagent_type` | DSH has no such field; `role` replaces it |
| `Task.isolation`, `environment: "cloud"` | The parent owns worktrees and passes paths |
| `~/.cursor/skills`, rules files | DSH reads skills and one overlay file |
| Cursor Automations, Bugbot, cloud agents | No DSH equivalent |
