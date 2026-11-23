// src/index.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import { snapshotJsonValue } from "@deepseek-ai/dsh-util-values";

// src/ids.ts
var PLUGIN_ID = "pstack-dsh";
var SKILL_PROVIDER_NAME = "pstack-dsh";
var OVERLAY_FILENAME = "pstack-dsh.json";
var TOOL_CATALOG = "pstack_catalog";
var TOOL_SPAWN = "pstack_spawn";
var TOOL_OVERLAY_READ = "pstack_overlay_read";
var TOOL_OVERLAY_WRITE = "pstack_overlay_write";
var SPAWN_PROVIDER = "spawn";
var SETTINGS_SNAPSHOT_PATH = "/plugins/pstack-dsh/settings";
var POTETO_STATE_PATH = "/plugins/pstack-dsh/poteto";

// src/plugin-config.ts
var Config = {
  "~standard": {
    version: 1,
    vendor: "pstack-dsh",
    validate(value) {
      if (value === void 0 || value === null) {
        return { value: { spawnProvider: "spawn" } };
      }
      if (typeof value !== "object" || Array.isArray(value)) {
        return { issues: [{ message: "config must be an object" }] };
      }
      const spawnProvider = value.spawnProvider;
      if (spawnProvider !== void 0 && (typeof spawnProvider !== "string" || spawnProvider.length === 0)) {
        return { issues: [{ message: "spawnProvider must be a non-empty string" }] };
      }
      return { value: { spawnProvider: spawnProvider ?? "spawn" } };
    }
  }
};

// src/skills-provider.ts
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// src/frontmatter.ts
var NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
function parseBool(value, fallback) {
  if (value === void 0) return fallback;
  const normalized = unquote(value).trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  throw new Error(`invalid boolean "${value}"`);
}
function parseSkillMarkdown(text, fallbackName) {
  text = text.replace(/\r\n/g, "\n");
  if (!text.startsWith("---")) return void 0;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return void 0;
  const raw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\s*\n/, "");
  const fields = {};
  for (const line of raw.split("\n")) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    fields[match[1]] = match[2] ?? "";
  }
  let name2 = unquote(fields.name ?? fallbackName);
  if (name2 === "Poteto Mode") name2 = "poteto-mode";
  if (!NAME_RE.test(name2)) return void 0;
  const description = unquote(fields.description ?? "");
  if (description.length === 0) return void 0;
  try {
    const disableModel = parseBool(fields["disable-model-invocation"], false);
    const userInvocable = parseBool(fields["user-invocable"], true);
    return {
      frontmatter: {
        name: name2,
        description,
        ...fields.whenToUse ? { whenToUse: unquote(fields.whenToUse) } : {},
        modelInvocable: !disableModel,
        userInvocable
      },
      content: body.trimStart()
    };
  } catch {
    return void 0;
  }
}

// src/skills-provider.ts
var BUNDLED_SKILL_RANK = 600;
function defaultSkillsRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
}
async function loadSkills(root) {
  let entries = [];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const records = [];
  for (const name2 of entries) {
    const dir = join(root, name2);
    const path = join(dir, "SKILL.md");
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch {
      continue;
    }
    const parsed = parseSkillMarkdown(text, name2);
    if (parsed === void 0) continue;
    records.push({
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      ...parsed.frontmatter.whenToUse === void 0 ? {} : { whenToUse: parsed.frontmatter.whenToUse },
      modelInvocable: parsed.frontmatter.modelInvocable,
      userInvocable: parsed.frontmatter.userInvocable,
      content: parsed.content,
      dir
    });
  }
  return records.sort((a, b) => a.name.localeCompare(b.name));
}
function createSkillProvider(skillsRoot = defaultSkillsRoot()) {
  return {
    name: SKILL_PROVIDER_NAME,
    async list() {
      const skills = await loadSkills(skillsRoot);
      return skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        ...skill.whenToUse === void 0 ? {} : { whenToUse: skill.whenToUse },
        invocation: {
          modelInvocable: skill.modelInvocable,
          userInvocable: skill.userInvocable
        },
        provider: SKILL_PROVIDER_NAME,
        source: "bundled",
        resourceBase: { kind: "directory", path: skill.dir },
        rank: BUNDLED_SKILL_RANK,
        locator: skill.dir,
        path: join(skill.dir, "SKILL.md")
      }));
    },
    async get(candidate) {
      const skills = await loadSkills(skillsRoot);
      const skill = skills.find((entry) => entry.name === candidate.name);
      if (skill === void 0) return void 0;
      return {
        name: skill.name,
        description: skill.description,
        ...skill.whenToUse === void 0 ? {} : { whenToUse: skill.whenToUse },
        invocation: {
          modelInvocable: skill.modelInvocable,
          userInvocable: skill.userInvocable
        },
        provider: SKILL_PROVIDER_NAME,
        source: "bundled",
        resourceBase: { kind: "directory", path: skill.dir },
        content: skill.content,
        path: join(skill.dir, "SKILL.md")
      };
    }
  };
}

// src/tools.ts
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";

// src/home.ts
import { homedir } from "node:os";
import { join as join2, resolve } from "node:path";
function resolveDshHome(env = process.env) {
  const fromEnv = env.DSH_HOME?.trim();
  if (fromEnv) return resolve(fromEnv);
  return join2(homedir(), ".dsh");
}

// src/overlay.ts
import { readFile as readFile2 } from "node:fs/promises";
import { join as join3 } from "node:path";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";

// src/roles.ts
var SCALAR_ROLES = [
  "feature, refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment and prose"
];
var PANEL_ROLES = [
  "arena runners",
  "arena cross-judge pool",
  "swarm workers",
  "interrogate reviewers"
];
var ALL_ROLES = [...SCALAR_ROLES, ...PANEL_ROLES];
var LEGACY_ALIASES = {
  feature: "feature, refactoring",
  refactoring: "feature, refactoring",
  "judgment-and-prose": "judgment and prose",
  "arena-runners": "arena runners",
  "arena-cross-judge-pool": "arena cross-judge pool",
  "swarm-workers": "swarm workers",
  "interrogate-reviewers": "interrogate reviewers"
};
var RETIRED_ROLES = [
  "how-critics",
  "how-explorer",
  "how-explainer",
  "why-investigators",
  "why-synthesizer",
  "reflect-tooling",
  "reflect-judgment",
  "reflect-fixers",
  "architect-runners",
  "hardest-tasks",
  "poteto-agent",
  "comment-sicko",
  "independent-verifier"
];
var RETIRED_SET = new Set(RETIRED_ROLES);
function normalizeRoleName(raw) {
  return raw.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}
function normalizeRole(raw) {
  const key = normalizeRoleName(raw);
  if (key === "poteto agent") return "poteto-agent";
  if (key === "comment sicko") return "comment-sicko";
  if (key === "generalpurpose" || key === "general purpose" || key === "general-purpose") return "poteto-agent";
  return LEGACY_ALIASES[key] ?? key;
}
function isPstackRole(value) {
  return ALL_ROLES.includes(value);
}
function isRetiredRole(value) {
  const key = normalizeRoleName(value);
  return RETIRED_SET.has(key) || RETIRED_SET.has(LEGACY_ALIASES[key] ?? "");
}
function isPanelRole(value) {
  return PANEL_ROLES.includes(value);
}

// src/overlay-model.ts
var OVERLAY_VERSION = 1;
function emptyOverlay() {
  const roles = {};
  for (const role of ALL_ROLES) {
    roles[role] = { inherit: true, routes: [] };
  }
  return { version: OVERLAY_VERSION, roles };
}
function routeKey(provider, model) {
  return `${provider}::${model}`;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseRoute(raw, path) {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const provider = raw.provider;
  const model = raw.model;
  if (typeof provider !== "string" || provider.length === 0) {
    throw new Error(`${path}.provider must be a non-empty string`);
  }
  if (typeof model !== "string" || model.length === 0) {
    throw new Error(`${path}.model must be a non-empty string`);
  }
  const effort = raw.reasoningEffort;
  if (effort !== void 0 && (typeof effort !== "string" || effort.length === 0)) {
    throw new Error(`${path}.reasoningEffort must be a non-empty string when set`);
  }
  const extra = Object.keys(raw).filter((key) => key !== "provider" && key !== "model" && key !== "reasoningEffort");
  if (extra.length > 0) throw new Error(`${path} has unknown fields: ${extra.join(", ")}`);
  return effort === void 0 ? { provider, model } : { provider, model, reasoningEffort: effort };
}
function parseRole(raw, role) {
  if (!isRecord(raw)) throw new Error(`roles.${role} must be an object`);
  const extra = Object.keys(raw).filter((key) => key !== "inherit" && key !== "routes");
  if (extra.length > 0) throw new Error(`roles.${role} has unknown fields: ${extra.join(", ")}`);
  const inherit = raw.inherit === true || raw.inherit === "true" || raw.inherit === "inherit-parent" || raw.inherit === "auto";
  const routesRaw = raw.routes;
  const routes = Array.isArray(routesRaw) ? routesRaw.map((entry, index) => parseRoute(entry, `roles.${role}.routes[${index}]`)) : [];
  if (inherit) return { inherit: true, routes: [] };
  if (routes.length === 0) return { inherit: true, routes: [] };
  if (!isPanelRole(role) && routes.length !== 1) {
    throw new Error(`roles.${role} is a scalar role and may have at most one route`);
  }
  return { inherit: false, routes };
}
function parseOverlay(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("pstack-dsh overlay is not valid JSON");
  }
  if (!isRecord(value)) throw new Error("pstack-dsh overlay must be an object");
  if (value.version !== OVERLAY_VERSION) {
    throw new Error(`pstack-dsh overlay version ${String(value.version)} is unsupported`);
  }
  const extra = Object.keys(value).filter((key) => key !== "version" && key !== "roles");
  if (extra.length > 0) throw new Error(`pstack-dsh overlay has unknown fields: ${extra.join(", ")}`);
  const rolesRaw = value.roles;
  if (!isRecord(rolesRaw)) throw new Error("pstack-dsh overlay.roles must be an object");
  const roles = {};
  for (const role of ALL_ROLES) roles[role] = { inherit: true, routes: [] };
  for (const [rawKey, rawValue] of Object.entries(rolesRaw)) {
    const key = normalizeRole(rawKey);
    if (isPstackRole(key)) {
      roles[key] = parseRole(rawValue, key);
      continue;
    }
    if (isRetiredRole(rawKey)) continue;
    throw new Error(`unknown pstack role "${rawKey}"`);
  }
  return { version: OVERLAY_VERSION, roles };
}
function validateOverlayAgainstCatalog(overlay, routes) {
  const errors = [];
  const live = new Map(routes.map((route) => [routeKey(route.provider, route.model), route]));
  for (const role of ALL_ROLES) {
    const assignment = overlay.roles[role] ?? { inherit: true, routes: [] };
    if (assignment.inherit) continue;
    for (const [index, entry] of assignment.routes.entries()) {
      const found = live.get(routeKey(entry.provider, entry.model));
      if (found === void 0) {
        errors.push(`${role}[${index}]: ${entry.provider}/${entry.model} is not listed by DSH`);
        continue;
      }
      if (entry.reasoningEffort === void 0) continue;
      if (found.efforts.length === 0) {
        errors.push(`${role}[${index}]: ${entry.provider}/${entry.model} has no effort field; omit reasoningEffort`);
        continue;
      }
      if (!found.efforts.some((effort) => effort.id === entry.reasoningEffort)) {
        errors.push(
          `${role}[${index}]: effort "${entry.reasoningEffort}" is not accepted by ${entry.provider}/${entry.model} (live: ${found.efforts.map((effort) => effort.id).join(", ")})`
        );
      }
    }
  }
  return errors;
}
function resolveRole(overlay, role) {
  const key = role;
  return overlay.roles[key] ?? { inherit: true, routes: [] };
}

// src/overlay.ts
function overlayPath(dshHome = resolveDshHome()) {
  return join3(dshHome, OVERLAY_FILENAME);
}
async function readOverlay(dshHome = resolveDshHome()) {
  const path = overlayPath(dshHome);
  try {
    const text = await readFile2(path, "utf8");
    return { path, overlay: parseOverlay(text), missing: false };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { path, overlay: emptyOverlay(), missing: true };
    }
    throw error;
  }
}
async function writeOverlay(overlay, dshHome = resolveDshHome()) {
  const path = overlayPath(dshHome);
  const body = `${JSON.stringify(overlay, null, 2)}
`;
  await writeFileAtomic(path, body, { mode: 384, dirMode: 448 });
  return path;
}

// src/catalog.ts
async function buildCatalog(host, signal) {
  const overlay = await readOverlay(host.dshHome ?? resolveDshHome(host.env));
  const routes = [];
  const seen = /* @__PURE__ */ new Set();
  const { llm } = host;
  if (llm !== void 0) {
    for (const provider of llm.listProviders()) {
      const models = await llm.listModels(provider.id).catch(() => []);
      for (const model of models) {
        const key = routeKey(provider.id, model.id);
        if (seen.has(key)) continue;
        seen.add(key);
        const resolved = await llm.resolveModelInfo(provider.id, model.id, signal).catch(() => void 0);
        const reasoning = resolved?.reasoning;
        const efforts = reasoning?.efforts.map(({ id, name: name2, description }) => ({
          id,
          name: name2,
          ...description === void 0 ? {} : { description }
        })) ?? [];
        const defaultEffort = reasoning?.defaultEffort;
        routes.push({
          provider: provider.id,
          providerName: provider.name,
          model: model.id,
          modelName: resolved?.name || model.name,
          efforts,
          ...defaultEffort === void 0 ? {} : { defaultEffort }
        });
      }
    }
  }
  return {
    routes,
    overlayPath: overlay.path,
    overlayMissing: overlay.missing,
    inheritParent: true,
    ...routes.length === 0 ? { emptyReason: "DSH lists no available models. Children inherit this conversation." } : {}
  };
}

// src/persona.ts
import { readFile as readFile3 } from "node:fs/promises";
import { dirname as dirname2, join as join4 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function defaultAgentsRoot() {
  return join4(dirname2(fileURLToPath2(import.meta.url)), "..", "agents");
}
function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  return text.slice(end + 4).replace(/^\s*\n/, "");
}
async function loadPersona(role, agentsRoot = defaultAgentsRoot()) {
  const key = normalizeRole(role);
  const files = key === "comment-sicko" ? ["comment-sicko.md"] : key === "poteto-agent" ? ["poteto-agent.md"] : [`${key}.md`, "poteto-agent.md"];
  for (const file of files) {
    try {
      const text = await readFile3(join4(agentsRoot, file), "utf8");
      const body = stripFrontmatter(text).trim();
      if (body.length > 0) return body;
    } catch {
      continue;
    }
  }
  return void 0;
}

// src/spawn.ts
function resolveSpawn(overlay, request) {
  const role = normalizeRole(request.role);
  const assignment = resolveRole(overlay, role);
  const index = request.routeIndex ?? 0;
  const route = assignment.inherit || assignment.routes.length === 0 ? void 0 : assignment.routes[index] ?? assignment.routes[0];
  const agentOptions = request.model ?? (route === void 0 ? void 0 : { provider: route.provider, model: route.model });
  const reasoningEffort = request.reasoningEffort ?? route?.reasoningEffort;
  return {
    role,
    description: request.description,
    prompt: request.prompt,
    runInBackground: request.runInBackground,
    inherit: agentOptions === void 0,
    ...agentOptions === void 0 ? {} : { agentOptions },
    ...reasoningEffort === void 0 ? {} : { reasoningEffort },
    ...route === void 0 ? {} : { route },
    routeSource: request.model !== void 0 ? "call" : agentOptions !== void 0 ? "role" : "inherit"
  };
}

// src/tools.ts
function textPrompt(prompt) {
  return [{ type: "text", text: prompt }];
}
function catalogTool(host) {
  return {
    name: TOOL_CATALOG,
    description: "List the provider/model pairs DSH exposes for pstack, along with their supported reasoning efforts.",
    parameters: {},
    async execute(_args, exec) {
      return buildCatalog(host, exec.signal);
    }
  };
}
function overlayReadTool(host) {
  return {
    name: TOOL_OVERLAY_READ,
    description: "Read $DSH_HOME/pstack-dsh.json. Missing file means inherit the parent conversation for every role.",
    parameters: {},
    async execute() {
      const current = await readOverlay(host.dshHome ?? resolveDshHome(host.env));
      return {
        path: current.path,
        missing: current.missing,
        overlay: current.overlay
      };
    }
  };
}
function overlayWriteTool(host) {
  return {
    name: TOOL_OVERLAY_WRITE,
    description: "Write $DSH_HOME/pstack-dsh.json after validating every provider/model/effort against pstack_catalog. inherit-parent is stored as inherit: true with empty routes.",
    parameters: {
      overlay: {
        type: "json",
        required: true,
        description: "Full overlay object { version: 1, roles: { <role>: { inherit, routes } } }"
      }
    },
    async execute(args) {
      const overlay = typeof args.overlay === "string" ? parseOverlay(args.overlay) : parseOverlay(JSON.stringify(args.overlay));
      const catalog = await buildCatalog(host);
      const errors = validateOverlayAgainstCatalog(overlay, catalog.routes);
      if (errors.length > 0) {
        throw new Error(`overlay rejected against live catalog:
${errors.join("\n")}`);
      }
      const path = await writeOverlay(overlay, host.dshHome ?? resolveDshHome(host.env));
      return { path, overlay };
    }
  };
}
function spawnTool(host) {
  return {
    name: TOOL_SPAWN,
    description: "Delegate a pstack role to a DSH subagent via ctx.subagents (spawn provider). Send description, prompt, role, and optional run_in_background. The role line in $DSH_HOME/pstack-dsh.json supplies the default route; send model or reasoning_effort only to adjust one job away from it. A role with no line inherits this conversation. Never send thinking, isolation, or subagent_type.",
    parameters: {
      description: {
        type: "string",
        required: true,
        description: "A short (3-5 word) description of the delegated task, for display."
      },
      prompt: {
        type: "string",
        required: true,
        description: "The complete, self-contained task. The child does not see this conversation."
      },
      role: {
        type: "string",
        required: true,
        description: "pstack role key. The nine mapped roles are feature, refactoring / bug-fix / perf-issue / hillclimb / judgment and prose / arena runners / arena cross-judge pool / swarm workers / interrogate reviewers. Any other name, such as how-explorer, inherits the parent route."
      },
      run_in_background: {
        type: "boolean",
        description: "Default true. Continuable children return a subagent id; one-shot background returns a job-like start without waiting."
      },
      route_index: {
        type: "number",
        description: "Which overlay route to use for a panel role. Default 0."
      },
      model: {
        type: "string",
        description: "Optional model to run this one child on, such as a weaker model for routine work or a stronger one for the hardest work. Must be a model pstack_catalog lists; omit to use the role line."
      },
      provider: {
        type: "string",
        description: "Provider for the model override. Omit when exactly one listed provider serves that model."
      },
      reasoning_effort: {
        type: "string",
        description: "Optional effort for this one child, one of the efforts the resolved model lists. Omit to use the role line or the model default."
      }
    },
    async execute(args, exec) {
      const parent = exec.agent;
      if (parent === void 0) throw new Error("pstack_spawn requires a calling agent");
      const subagents = host.subagents;
      if (subagents === void 0) throw new Error("pstack_spawn requires ctx.subagents");
      const role = normalizeRole(String(args.role ?? ""));
      if (role.length === 0) throw new Error("pstack_spawn role is required");
      const overlay = (await readOverlay(host.dshHome ?? resolveDshHome(host.env))).overlay;
      const modelArg = stringArg(args.model);
      const providerArg = stringArg(args.provider);
      const effortArg = stringArg(args.reasoning_effort);
      const call = await resolveCallRoute(host, overlay, role, modelArg, providerArg, effortArg, exec.signal);
      const resolved = resolveSpawn(overlay, {
        role,
        description: String(args.description ?? ""),
        prompt: String(args.prompt ?? ""),
        runInBackground: args.run_in_background !== false,
        routeIndex: typeof args.route_index === "number" ? args.route_index : void 0,
        ...call.model === void 0 ? {} : { model: call.model },
        ...call.reasoningEffort === void 0 ? {} : { reasoningEffort: call.reasoningEffort }
      });
      if (resolved.description.trim().length === 0) throw new Error("description is required");
      if (resolved.prompt.trim().length === 0) throw new Error("prompt is required");
      const persona = await loadPersona(resolved.role);
      const activation = await subagents.startActivation({
        provider: host.spawnProvider ?? SPAWN_PROVIDER,
        label: resolved.description,
        prompt: persona ? [...textPrompt(persona), ...textPrompt(resolved.prompt)] : textPrompt(resolved.prompt),
        parent,
        signal: exec.signal ?? new AbortController().signal,
        delivery: resolved.runInBackground ? "parent" : "caller",
        ...resolved.agentOptions ? { agentOptions: {
          ...resolved.agentOptions,
          ...resolved.reasoningEffort ? { reasoningEffort: ReasoningEffortId(resolved.reasoningEffort) } : {}
        } } : {}
      });
      const receipt = {
        subagentId: activation.childId,
        name: activation.name,
        role: resolved.role,
        inherit: resolved.inherit,
        routeSource: resolved.routeSource
      };
      if (resolved.runInBackground) return { kind: "activation", ...receipt };
      try {
        const result = await activation.result;
        return { kind: "foreground", ...receipt, runId: activation.childId, output: result.output ?? null, stopReason: result.stopReason };
      } finally {
        await activation.dispose();
      }
    }
  };
}
function stringArg(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
async function resolveCallRoute(host, overlay, role, modelArg, providerArg, effortArg, signal) {
  if (modelArg === void 0) {
    if (providerArg !== void 0) throw new Error("provider needs a model");
    if (effortArg === void 0) return {};
    const assignment = resolveRole(overlay, role);
    const mapped = !assignment.inherit && assignment.routes.length > 0;
    if (!mapped) throw new Error(`reasoning_effort "${effortArg}" needs a model, because role "${role}" has no mapped route`);
    return { reasoningEffort: effortArg };
  }
  const catalog = await buildCatalog(host, signal);
  const matches = catalog.routes.filter((route) => route.model === modelArg || `${route.provider}/${route.model}` === modelArg);
  if (matches.length === 0) {
    throw new Error(`model "${modelArg}" is not listed by DSH. Run pstack_catalog and pick a listed model.`);
  }
  let chosen = matches[0];
  if (providerArg !== void 0) {
    const byProvider = matches.find((route) => route.provider === providerArg);
    if (byProvider === void 0) {
      throw new Error(`model "${modelArg}" is not listed under provider "${providerArg}". Listed providers: ${matches.map((route) => route.provider).join(", ")}.`);
    }
    chosen = byProvider;
  } else if (matches.length > 1) {
    throw new Error(`model "${modelArg}" is listed by ${matches.map((route) => route.provider).join(", ")}; send provider too.`);
  }
  if (effortArg !== void 0 && chosen.efforts.length > 0 && !chosen.efforts.some((effort) => effort.id === effortArg)) {
    throw new Error(`model "${modelArg}" does not support effort "${effortArg}". Listed efforts: ${chosen.efforts.map((effort) => effort.id).join(", ")}.`);
  }
  return {
    model: { provider: chosen.provider, model: chosen.model },
    ...effortArg === void 0 ? {} : { reasoningEffort: effortArg }
  };
}

// src/poteto-mode.ts
import { readFileSync } from "node:fs";
import { dirname as dirname3, join as join5 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { writeFileAtomic as writeFileAtomic2 } from "@deepseek-ai/dsh-atomic-write";
var COMMAND_NAME = "pstack-poteto-mode";
var MODE_FILENAME = "pstack-poteto.json";
var NATIVE_DELEGATION_TOOLS = ["subagent", "subagent_fork"];
var SECTION_NAME = "pstack:poteto-workflow";
var SECTION_ORDER = 10;
var REMINDER = "Poteto workflow is active. Follow the poteto-mode instructions in the system prompt strictly, and do not skip any required step or rule it names. Delegate only through pstack_spawn so the role mapping decides the route.";
function modePath(dshHome = resolveDshHome()) {
  return join5(dshHome, MODE_FILENAME);
}
function readModes(dshHome = resolveDshHome()) {
  try {
    const parsed = JSON.parse(readFileSync(modePath(dshHome), "utf8"));
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return /* @__PURE__ */ new Set();
    return new Set(parsed.sessions.filter((id) => typeof id === "string"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function writeModes(sessions, dshHome = resolveDshHome()) {
  const body = `${JSON.stringify({ version: 1, sessions: [...sessions].sort() }, null, 2)}
`;
  await writeFileAtomic2(modePath(dshHome), body, { mode: 384, dirMode: 448 });
}
function potetoSkillText() {
  try {
    const file = join5(dirname3(fileURLToPath3(import.meta.url)), "..", "skills", "poteto-mode", "SKILL.md");
    return parseSkillMarkdown(readFileSync(file, "utf8"), "poteto-mode")?.content ?? "";
  } catch {
    return "";
  }
}
var sessionIdOf = (agent) => String(agent.session.id);
var isRootAgent = (agent) => agent.session.header.origin !== "subagent";
function registerPotetoMode(ctx) {
  const commands = ctx.get("commands");
  if (commands === void 0) return void 0;
  const modes = readModes();
  const applied = /* @__PURE__ */ new Map();
  const remindedFor = /* @__PURE__ */ new WeakMap();
  const applyTo = (agent) => {
    if (!isRootAgent(agent)) return;
    const record = applied.get(agent) ?? { tools: /* @__PURE__ */ new Set(), section: void 0, disposers: [] };
    applied.set(agent, record);
    const tools = agent.ctx.get("tools");
    const missing = tools === void 0 ? [] : NATIVE_DELEGATION_TOOLS.filter((name2) => !record.tools.has(name2) && tools.get(name2, agent) !== void 0);
    if (tools !== void 0 && missing.length > 0) {
      try {
        record.disposers.push(tools.restrict({ deny: missing }));
        for (const name2 of missing) record.tools.add(name2);
      } catch {
      }
    }
    if (record.section === void 0) {
      const prompt = agent.ctx.get("systemPrompt");
      const text = potetoSkillText();
      if (prompt !== void 0 && text !== "") {
        try {
          const dispose = prompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text, interpolate: false });
          record.section = dispose;
          record.disposers.push(dispose);
        } catch {
        }
      }
    }
  };
  const clear = (agent) => {
    const record = applied.get(agent);
    if (record === void 0) return;
    for (const dispose of record.disposers.reverse()) {
      try {
        dispose();
      } catch {
      }
    }
    applied.delete(agent);
  };
  const agentOf = (sessionId) => ctx.get("agents")?.get(sessionId);
  const stateOf = (sessionId) => {
    const agent = agentOf(sessionId);
    return {
      enabled: modes.has(sessionId),
      denied: agent === void 0 ? [] : [...applied.get(agent)?.tools ?? []]
    };
  };
  const sync = (sessionId) => {
    if (!modes.has(sessionId)) return;
    const agent = agentOf(sessionId);
    if (agent !== void 0) applyTo(agent);
  };
  const setEnabled = async (sessionId, enabled) => {
    const agent = agentOf(sessionId);
    if (enabled && agent !== void 0 && !isRootAgent(agent)) {
      throw new Error("the poteto switch is only available in the session that runs the workflow, not in a delegate");
    }
    if (enabled) {
      modes.add(sessionId);
      await writeModes(modes);
      if (agent !== void 0) applyTo(agent);
    } else {
      modes.delete(sessionId);
      await writeModes(modes);
      if (agent !== void 0) clear(agent);
    }
    return stateOf(sessionId);
  };
  const switchApi = { read: stateOf, setEnabled, sync };
  commands.register({
    name: COMMAND_NAME,
    description: "Turn the poteto workflow on or off for this session. While on, the native subagent tools are disabled so delegation has to use pstack_spawn and its role mapping.",
    input: { hint: "on | off | status" },
    handler: async ({ agent, rawInput }) => {
      const sessionId = sessionIdOf(agent);
      const argument = (rawInput.trim().split(/\s+/)[0] ?? "").toLowerCase();
      if (argument === "" || argument === "status") {
        const state = stateOf(sessionId);
        return {
          kind: "success",
          text: state.enabled ? `poteto workflow: on. Denied here: ${state.denied.length === 0 ? "nothing yet" : state.denied.join(", ")}.` : "poteto workflow: off. The native subagent tools are available."
        };
      }
      if (argument === "on" || argument === "off") {
        try {
          const state = await setEnabled(sessionId, argument === "on");
          return {
            kind: "success",
            text: state.enabled ? `poteto workflow: on. The native subagent tools are now denied for this session, so delegation goes through pstack_spawn and the role mapping in $DSH_HOME/pstack-dsh.json. The poteto-mode instructions joined the system prompt.` : "poteto workflow: off. The native subagent tools are available again."
          };
        } catch (error) {
          return { kind: "error", text: error instanceof Error ? error.message : "switch failed" };
        }
      }
      return { kind: "error", text: "Usage: /pstack-poteto-mode on | off | status" };
    }
  });
  ctx.on("agent/created", (payload) => {
    if (modes.has(sessionIdOf(payload.agent))) applyTo(payload.agent);
  });
  ctx.on("agent/pre-step", async (payload, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    if (!modes.has(sessionIdOf(payload.agent))) return decision;
    applyTo(payload.agent);
    const latest = payload.messages.filter((message) => message.source?.kind === "user").at(-1);
    if (latest === void 0 || remindedFor.get(payload.agent) === latest.id) return decision;
    remindedFor.set(payload.agent, latest.id);
    const reminder = createUserMessage({
      content: [{ type: "text", text: REMINDER }],
      source: { kind: "system-prompt" }
    });
    return { ...decision, messages: [...decision.messages, reminder] };
  }, { prepend: true });
  ctx.on("tools/change", () => {
    for (const agent of ctx.get("agents")?.list() ?? []) {
      if (modes.has(sessionIdOf(agent))) applyTo(agent);
    }
  });
  for (const agent of ctx.get("agents")?.list() ?? []) {
    if (modes.has(sessionIdOf(agent))) applyTo(agent);
  }
  return switchApi;
}

// src/http-trust.ts
function trustedRequest(req) {
  const remote = req.socket.remoteAddress;
  if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const host = req.headers.host;
  if (host === void 0) return false;
  const origin = req.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === new URL(`http://${host}`).host;
  } catch {
    return false;
  }
}
function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(value));
}
async function readJson(req, maxBytes = 262144) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// src/poteto-routes.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function handle(switchApi, req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url ?? POTETO_STATE_PATH, "http://localhost");
    const session = url.searchParams.get("session") ?? "";
    if (session === "") {
      json(res, 400, { error: "session is required" });
      return;
    }
    json(res, 200, { session, ...switchApi.read(session) });
    return;
  }
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const body = await readJson(req);
      const session = isRecord2(body) && typeof body.session === "string" ? body.session : "";
      const enabled = isRecord2(body) && typeof body.enabled === "boolean" ? body.enabled : void 0;
      if (session === "" || enabled === void 0) {
        json(res, 400, { error: "session and enabled are required" });
        return;
      }
      json(res, 200, { session, ...await switchApi.setEnabled(session, enabled) });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : "switch failed" });
    }
    return;
  }
  json(res, 405, { error: "method not allowed" });
}
function registerPstackPotetoRoutes(ctx, switchApi) {
  const webServer = ctx.webServer;
  if (webServer === void 0) return;
  ctx.effect(() => {
    const routes = [
      webServer.register({
        kind: "exact",
        path: POTETO_STATE_PATH,
        handler: async (req, res) => {
          const rejection = ctx.connection.requestRejection(req);
          if (rejection !== void 0) {
            json(res, rejection, { error: rejection === 401 ? "unauthorized" : "forbidden" });
            return;
          }
          if (!trustedRequest(req)) {
            json(res, 403, { error: "forbidden" });
            return;
          }
          await handle(switchApi, req, res);
        }
      })
    ];
    return () => {
      for (const dispose of routes) dispose();
    };
  }, "pstack-dsh: poteto switch route");
}

// src/settings-draft.ts
function liveFor(routes, provider, model) {
  return routes.find((route) => route.provider === provider && route.model === model);
}
function stripIllegalEffort(route, live) {
  const found = liveFor(live, route.provider, route.model);
  if (found === void 0) return { provider: route.provider, model: route.model };
  if (route.reasoningEffort === void 0) return { provider: route.provider, model: route.model };
  if (found.efforts.length === 0) return { provider: route.provider, model: route.model };
  if (!found.efforts.some((effort) => effort.id === route.reasoningEffort)) {
    return { provider: route.provider, model: route.model };
  }
  return { provider: route.provider, model: route.model, reasoningEffort: route.reasoningEffort };
}
function dropUnselectableRoles(overlay, live) {
  const next = emptyOverlay();
  const droppedRoles = [];
  const selectable = new Set(live.map((route) => routeKey(route.provider, route.model)));
  for (const role of ALL_ROLES) {
    const assignment = overlay.roles[role] ?? { inherit: true, routes: [] };
    if (assignment.inherit || assignment.routes.length === 0) {
      next.roles[role] = { inherit: true, routes: [] };
      continue;
    }
    const kept = assignment.routes.filter((route) => selectable.has(routeKey(route.provider, route.model))).map((route) => stripIllegalEffort(route, live));
    if (kept.length === 0) {
      droppedRoles.push(role);
      next.roles[role] = { inherit: true, routes: [] };
      continue;
    }
    if (kept.length !== assignment.routes.length) droppedRoles.push(role);
    next.roles[role] = {
      inherit: false,
      routes: isPanelRole(role) ? kept : [kept[0]]
    };
  }
  return { overlay: next, droppedRoles };
}

// src/settings-api.ts
async function loadSettingsSnapshot(host) {
  const dshHome = host.dshHome ?? resolveDshHome(host.env);
  const catalog = await buildCatalog({ ...host, dshHome });
  const current = await readOverlay(dshHome);
  const { overlay, droppedRoles } = dropUnselectableRoles(current.overlay, catalog.routes);
  return {
    catalog,
    overlay,
    path: current.path,
    missing: current.missing,
    droppedRoles
  };
}
async function saveSettingsOverlay(host, raw) {
  const dshHome = host.dshHome ?? resolveDshHome(host.env);
  const overlay = typeof raw === "string" ? parseOverlay(raw) : parseOverlay(JSON.stringify(raw));
  const catalog = await buildCatalog({ ...host, dshHome });
  const errors = validateOverlayAgainstCatalog(overlay, catalog.routes);
  if (errors.length > 0) {
    const error = new Error(`overlay rejected against live catalog:
${errors.join("\n")}`);
    error.errors = errors;
    throw error;
  }
  const path = await writeOverlay(overlay, dshHome);
  return { path, overlay };
}

// src/settings-routes.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function handleSnapshot(host, req, res) {
  if (req.method !== "GET") {
    json(res, 405, { error: "method not allowed" });
    return;
  }
  json(res, 200, await loadSettingsSnapshot(host));
}
async function handleSave(host, req, res) {
  if (req.method !== "PUT" && req.method !== "POST") {
    json(res, 405, { error: "method not allowed" });
    return;
  }
  try {
    const body = await readJson(req);
    const overlay = isRecord3(body) && "overlay" in body ? body.overlay : body;
    const saved = await saveSettingsOverlay(host, overlay);
    json(res, 200, saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "save failed";
    const errors = error instanceof Error && "errors" in error && Array.isArray(error.errors) ? error.errors : void 0;
    json(res, 400, { error: message, ...errors === void 0 ? {} : { errors } });
  }
}
function registerPstackSettingsRoutes(ctx, host) {
  const webServer = ctx.webServer;
  if (webServer === void 0) return;
  ctx.effect(() => {
    const routes = [
      webServer.register({
        kind: "exact",
        path: SETTINGS_SNAPSHOT_PATH,
        handler: async (req, res) => {
          const rejection = ctx.connection.requestRejection(req);
          if (rejection !== void 0) {
            json(res, rejection, { error: rejection === 401 ? "unauthorized" : "forbidden" });
            return;
          }
          if (!trustedRequest(req)) {
            json(res, 403, { error: "forbidden" });
            return;
          }
          if (req.method === "GET") {
            await handleSnapshot(host, req, res);
            return;
          }
          await handleSave(host, req, res);
        }
      })
    ];
    return () => {
      for (const dispose of routes) dispose();
    };
  }, "pstack-dsh: Settings overlay routes");
}

// src/index.ts
var name = PLUGIN_ID;
var inject = ["tools", "skills", "commands", "agents"];
var JSON_OUTPUT = {
  schema: { type: "json" },
  render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
};
function asHost(ctx, config) {
  return {
    get llm() {
      return ctx.get("llm");
    },
    get subagents() {
      return ctx.get("subagents");
    },
    spawnProvider: config?.spawnProvider ?? SPAWN_PROVIDER
  };
}
function registerOne(ctx, tool) {
  ctx.tools.register(defineTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const snapshot = snapshotJsonValue(await tool.execute(args, exec));
      if (snapshot === void 0) throw new TypeError(`pstack tool ${tool.name} returned a non-JSON value`);
      return snapshot;
    }
  }));
}
function apply(ctx, config) {
  console.log("[my-plugins/pstack-dsh] loaded");
  const host = asHost(ctx, config);
  registerOne(ctx, catalogTool(host));
  registerOne(ctx, overlayReadTool(host));
  registerOne(ctx, overlayWriteTool(host));
  registerOne(ctx, spawnTool(host));
  ctx.skills.registerProvider(() => createSkillProvider());
  const poteto = registerPotetoMode(ctx);
  ctx.inject(["webServer", "connection"], (webCtx) => {
    registerPstackSettingsRoutes(webCtx, host);
    if (poteto !== void 0) registerPstackPotetoRoutes(webCtx, poteto);
  });
}
export {
  Config,
  apply,
  inject,
  name
};
