# pstack for DeepSeek Harness

A DSH adaptation of [poteto's pstack](https://github.com/cursor/plugins/tree/main/pstack). The 23 playbooks, the 24 principles, the agents, and the guide are upstream's text, taken from `cursor/plugins` commit [`792440e8`](https://github.com/cursor/plugins/commit/792440e8a560a4a3f63748cdee70491ecd412982) and generated into this package. This repo's own code is the harness call layer plus the role editor.

## Install

Open **设置 → 插件 → 添加插件** and enter:

```text
github:yuanv4/dsh-pstack
```

Or from the CLI, which writes the `web` profile only:

```sh
dsh plugin --profile web add github:yuanv4/dsh-pstack
```

Then start a session and turn on the **poteto workflow** row in the model menu.

## What works differently here

DSH's `subagent` tool takes no model and no effort. So a role's model lives in `$DSH_HOME/pstack-dsh.json` and `pstack_spawn` reads it at spawn time. A single job may still pass `model` and `reasoning_effort` to adjust that route, the way upstream skills adjust a delegate per task. Nine roles can hold a mapping, matching upstream's `setup-pstack` lines. Any other role name a skill uses runs on the conversation's own route.

Open **插件 → pstack-dsh**. The bundle's page carries the role editor under its description: every model DSH currently offers, with that model's own reasoning efforts, plus the **新会话默认启用 poteto 工作流** switch described below. The editor is a page section, not a dialog, so leaving the page drops unsaved edits.

The [DSH platform map](harness/pstack/dsh/generated/docs/harness/dsh.md) lists runtime mappings and skipped features. Run `node scripts/generate-pstack-harness-trees.mjs --check` to check the generated tree without changing it.

## Turn the switch on

The plugin is inert in a session until you turn it on. The control is the **poteto workflow** row in the model menu, next to **Enable Agent Teams**; there is no command and no skill entry point. The choice is stored per session in `$DSH_HOME/pstack-poteto.json` and restored on the next start; if the Web client is unavailable, add or remove the session id there and restart DSH.

To start every new session with the workflow already on, open **插件 → pstack-dsh** and turn on **新会话默认启用 poteto 工作流** on that page, then save. The default is stored in `$DSH_HOME/pstack-settings.json`; it applies to sessions created after you save and never changes a session that is already open. The model-menu row still turns an individual session off again.

While the switch is on, the session gets the whole workflow:

- `pstack_catalog`, `pstack_overlay_read`, `pstack_overlay_write`, `pstack_spawn`, and `pstack_interrupt` are available, and the bundled skills are advertised to the model.
- `subagent` and `subagent_fork` are denied for that agent, so the only way to delegate is `pstack_spawn` and every child gets its role's route or inherits this conversation. The optional `name` argument gives an Agent Teams teammate a stable task-board address; `pstack_interrupt` stops a child by name or Session id.
- The poteto-mode instructions join that session's system prompt, so they are present on every request, and one short reminder line is appended to each new user turn.

While the switch is off, the session has none of it: every bundled tool is withheld, every bundled skill leaves the model catalog and the `/` menu, and no prompt section is added. The native delegation tools are left alone. Saving skill text alone cannot stop a model from calling the native `subagent` tool, which knows nothing about the role mapping, which is why the switch withholds this plugin's own tools instead of relying on prose.

A delegate inherits the switch from the session that started it, because it runs inside that session's workflow. The switch can be turned on only in the session that runs the workflow, not inside a delegate.

## Repository layout

The [DSH platform project](<harness/pstack/dsh/>) contains both authored sources and generated outputs. The repository uses one root [npm package](<package.json>), not a separate package for each directory.

```text
pstack/                         Pinned upstream snapshot. Do not edit by hand.
upstream.lock.json              Source commit, tree mappings, and hashes.
harness/pstack/dsh/
	adaptations/                DSH rewrites, setup sources, and platform map.
	src/                        Runtime tools, routing, settings, and editor UI.
	tests/                      Source, generated-output, and runtime checks.
	generated/                  Installation resources. Do not edit by hand.
	dist/                       Compiled runtime output from npm run build.
scripts/                        Fetch, generation, build, and package checks.
package.json                    Package exports, dependencies, and npm scripts.
tsconfig.json                   Runtime and test TypeScript configuration.
tsconfig.client.json            Browser TypeScript configuration.
cordis.patch.yml                DSH bundle registration.
```

The [tree generator](<scripts/generate-pstack-harness-trees.mjs>) owns only the [DSH installation resources](<harness/pstack/dsh/generated/>), not the whole platform project. Change the [DSH adaptation sources](<harness/pstack/dsh/adaptations/>) and regenerate with `node scripts/generate-pstack-harness-trees.mjs`. The [build script](<scripts/build.mjs>) compiles the [DSH runtime sources](<harness/pstack/dsh/src/>) into the separate [runtime output directory](<harness/pstack/dsh/dist/>).

## Working on this repo

Run these commands from the repository root.

| Command | What it does |
|---|---|
| `npm run sync:skills` | Re-fetches the pinned upstream commit and regenerates the DSH installation resources. |
| `npm run build` | Compiles the runtime into the [DSH runtime output directory](<harness/pstack/dsh/dist/>). |
| `npm test` | Builds the runtime, then runs the [DSH tests](<harness/pstack/dsh/tests/>). Does not typecheck. |
| `npm run typecheck` | Checks the runtime, test, and browser TypeScript sources without emitting files. |
| `npm run check` | Checks generated output, typechecks, then builds and runs the tests. |
| `npm run check:package` | Checks generated output, builds, and smoke-tests an actual npm tarball with a fake DSH host. Does not test live DSH activation. |

[upstream.lock.json](<upstream.lock.json>) records the source repository, commit, mappings, Git blob hashes, and normalized snapshot hashes. Run `node scripts/fetch-upstream.mjs --verify` to compare the snapshot with the lock offline. The fetch verifies the complete upstream tree and downloaded blobs before replacing the selected snapshot trees. [`scripts/generate-pstack-harness-trees.mjs`](scripts/generate-pstack-harness-trees.mjs) generates the trees, [`harness/pstack/dsh/adaptations/rewrites.mjs`](harness/pstack/dsh/adaptations/rewrites.mjs) holds the DSH rewrites, and [`harness/pstack/dsh/tests/skills-generated.spec.ts`](harness/pstack/dsh/tests/skills-generated.spec.ts) checks generated files. To update the pin, change the commit in the lock, run `node scripts/fetch-upstream.mjs --update-lock`, run `npm run sync:skills`, and review the diff. The lock update downloads and verifies the new upstream blobs. Update the pinned links in this README and the authored [DSH platform map](harness/pstack/dsh/adaptations/dsh.md), plus the acceptance pin in [upstream-source.spec.ts](harness/pstack/dsh/tests/upstream-source.spec.ts), then regenerate the installation tree. A filesystem error during snapshot replacement can leave a partial snapshot; rerun the sync to restore the managed trees. An inventory mismatch caused by files outside those trees requires inspection; rerunning does not remove those files.

## License

MIT. Playbooks and principles are poteto's, from `cursor/plugins`. This adaptation is not endorsed by them.
