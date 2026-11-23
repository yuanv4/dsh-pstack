---
name: setup-pstack
description: Optional pointer. Role routing is configured in DSH Plugins → pstack-dsh → Configure. Writes $DSH_HOME/pstack-dsh.json. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack

Optional. A fresh install already works: every role inherits this conversation.

DSH is a web product. Role routing lives on the **Settings** page, not in a TUI.

## Open the editor

1. Open **Plugins** and select the **pstack-dsh** bundle.
2. Click **Configure** in the detail header.
3. Save. That writes `$DSH_HOME/pstack-dsh.json`, the same overlay `pstack_spawn` already reads.

There is no supported Host API to open that section from a slash skill (`packages/client/ui-settings-general/src/client/SettingsRoot.tsx` `openSection` is onboarding-only). Tell the user to click it.

Do not write `~/.cursor/rules`. Do not write `~/.grok/roles`. Do not invent Cursor panel slugs or grok effort ladders. Do not run a long `ask_user_question` picker as the editor.

## What the page lists

The page lists models advertised by DSH adapters. See [`references/catalog.md`](references/catalog.md). Empty list means inherit.

## If they are not on Web

Say that configuration is Plugins → pstack-dsh → Configure on DSH Web. Leave overlay missing so every spawn inherits. Do not invent a second config file.

## Spawn reminder

Follow [`references/spawn.md`](references/spawn.md). The role route is the default. Use a catalog-validated model or effort override when the job needs one.
