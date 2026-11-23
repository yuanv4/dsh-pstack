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

Then start a session and run `/poteto-mode`, or any bundled skill from the `/` menu.

## What works differently here

DSH's `subagent` tool takes no model and no effort. So a role's model lives in `$DSH_HOME/pstack-dsh.json` and `pstack_spawn` reads it at spawn time. A single job may still pass `model` and `reasoning_effort` to adjust that route, the way upstream skills adjust a delegate per task. Nine roles can hold a mapping, matching upstream's `setup-pstack` lines. Any other role name a skill uses runs on the conversation's own route.

Open **插件 → pstack-dsh → 配置** to edit the mapping. The page lists every model DSH currently offers, with that model's own reasoning efforts.

The [DSH platform map](harness/pstack/dsh/generated/docs/harness/dsh.md) lists runtime mappings and skipped features. Run `node scripts/generate-pstack-harness-trees.mjs --check` to check the generated tree without changing it.

## Turn the switch on

Skill text alone cannot stop a model from calling the native `subagent` tool, which knows nothing about the role mapping. So this plugin ships a session switch:

```text
/pstack-poteto-mode on
/pstack-poteto-mode status
/pstack-poteto-mode off
```

The same switch is a row in the model menu, named `poteto workflow`, next to **Enable Agent Teams**. Toggling it switches the session. While it is on, the plugin denies `subagent` and `subagent_fork` for that agent and puts the poteto-mode instructions into that session's system prompt, so they are present on every request. It also appends one short reminder line to each new user turn, which is what the reference port does. The only way left to delegate is `pstack_spawn`, so every child gets its role's route or inherits this conversation. The optional `name` argument gives an Agent Teams teammate a stable task-board address. Use `pstack_interrupt` to stop a child by name or Session id. The switch persists per session in `$DSH_HOME/pstack-poteto.json` and is restored on the next start. It can be turned on only in the session that runs the workflow, not inside a delegate.

Without the switch, `/poteto-mode` still works as a skill, but nothing stops a delegation from skipping the route mapping.

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
