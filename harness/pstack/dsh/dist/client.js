window.__ModuleLoader__.load({
	id: "dsh-pstack",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// harness/pstack/dsh/src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// harness/pstack/dsh/src/client/PotetoToggle.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
var STYLE_ID = "pstack-poteto-row-style";
var ROW_CSS = `
.pstack-poteto-row {
  border-radius: var(--dsw-radius-md);
  min-height: 34px;
  color: var(--dsw-alias-label-primary);
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 0 8px;
  font-size: 13px;
  line-height: 20px;
  display: flex;
  position: relative;
}
.pstack-poteto-label { align-items: center; gap: 4px; min-width: 0; display: inline-flex; }
.pstack-poteto-info { z-index: 1; width: 20px; height: 20px; color: var(--dsw-alias-label-caption); flex: none; padding: 0; position: relative; }
.pstack-poteto-row .pstack-poteto-switch { position: static; }
.pstack-poteto-row .pstack-poteto-switch:after { content: ""; border-radius: var(--dsw-radius-md); position: absolute; inset: 0; }
.pstack-poteto-row:has(.pstack-poteto-switch:focus-visible) { background: var(--dsw-alias-interactive-bg-hover); }
@media (hover: hover) {
  .pstack-poteto-row:has(.pstack-poteto-switch:not(:disabled)):hover { background: var(--dsw-alias-interactive-bg-hover); }
}
`;
function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ROW_CSS;
  document.head.append(style);
}
function PotetoToggle({ sessionId, readMode, selectMode, t }) {
  const [enabled, setEnabled] = (0, import_react.useState)(void 0);
  const [pending, setPending] = (0, import_react.useState)(false);
  const [failure, setFailure] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let live = true;
    ensureStyle();
    setEnabled(void 0);
    setFailure(null);
    readMode().then((value) => {
      if (live) setEnabled(value);
    }, () => {
      if (live) setFailure(null);
    });
    return () => {
      live = false;
    };
  }, [sessionId, readMode]);
  if (enabled === void 0) return null;
  const select = (next) => {
    setPending(true);
    setFailure(null);
    selectMode(next).then(
      (error) => {
        if (error === null) setEnabled(next);
        else setFailure(error);
      },
      (error) => {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    ).finally(() => {
      setPending(false);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-poteto-row", title: failure ?? void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "pstack-poteto-label", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("switchLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t("switchDescription"), side: "top", delayMs: 300, maxWidth: 300, portal: true, openOnClick: true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", className: "pstack-poteto-info", "aria-label": t("switchInfoLabel"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconInfoOutlineRegular, { size: 11, "aria-hidden": "true" }) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Switch,
      {
        className: "pstack-poteto-switch",
        checked: enabled,
        disabled: pending,
        label: t("switchLabel"),
        onChange: select
      }
    )
  ] });
}

// harness/pstack/dsh/src/client/PstackSettings.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// harness/pstack/dsh/src/roles.ts
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
function isPanelRole(value) {
  return PANEL_ROLES.includes(value);
}

// harness/pstack/dsh/src/overlay-model.ts
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

// harness/pstack/dsh/src/settings-draft.ts
function overlayToDraft(overlay) {
  return ALL_ROLES.map((role) => {
    const assignment = overlay.roles[role] ?? { inherit: true, routes: [] };
    const inherit = assignment.inherit || assignment.routes.length === 0;
    return {
      role,
      panel: isPanelRole(role),
      inherit,
      inheritChoice: "inherit-parent",
      routes: inherit ? [] : assignment.routes.map((route) => ({ ...route }))
    };
  });
}
function draftToOverlay(drafts) {
  const overlay = emptyOverlay();
  for (const draft of drafts) {
    if (draft.inherit || draft.routes.length === 0) {
      overlay.roles[draft.role] = { inherit: true, routes: [] };
      continue;
    }
    overlay.roles[draft.role] = {
      inherit: false,
      routes: draft.panel ? draft.routes.map((route) => ({ ...route })) : [draft.routes[0]]
    };
  }
  return overlay;
}
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
function applyInheritAll(drafts, choice = "inherit-parent") {
  return drafts.map((draft) => ({
    ...draft,
    inherit: true,
    inheritChoice: choice,
    routes: []
  }));
}
function applyRouteToAll(drafts, route, live) {
  const cleaned = stripIllegalEffort(route, live);
  if (liveFor(live, cleaned.provider, cleaned.model) === void 0) return drafts;
  return drafts.map((draft) => ({
    ...draft,
    inherit: false,
    inheritChoice: "inherit-parent",
    routes: draft.panel ? [{ ...cleaned }] : [{ ...cleaned }]
  }));
}
function routeSelectValue(draft, index = 0) {
  if (draft.inherit || draft.routes.length === 0) return draft.inheritChoice;
  const route = draft.routes[index];
  if (route === void 0) return draft.inheritChoice;
  return routeKey(route.provider, route.model);
}
function parseRouteSelectValue(value, live) {
  if (value === "inherit-parent" || value === "auto") {
    return { inherit: true, inheritChoice: value };
  }
  const separator = value.indexOf("::");
  if (separator <= 0) return { inherit: true, inheritChoice: "inherit-parent" };
  const provider = value.slice(0, separator);
  const model = value.slice(separator + 2);
  const found = liveFor(live, provider, model);
  if (found === void 0) return { inherit: true, inheritChoice: "inherit-parent" };
  return { inherit: false, route: { provider: found.provider, model: found.model } };
}

// harness/pstack/dsh/src/ids.ts
var PLUGIN_ID = "dsh-pstack";
var SETTINGS_SNAPSHOT_PATH = "/plugins/dsh-pstack/settings";
var SETTINGS_SAVE_PATH = "/plugins/dsh-pstack/settings";
var POTETO_STATE_PATH = "/plugins/dsh-pstack/poteto";

// harness/pstack/dsh/src/client/api.ts
function listenForCatalogChanges(ctx, listener) {
  const disposers = [
    ctx.remote.$on("llm/adapters-updated", listener),
    ctx.remote.$on("llm/models-updated", listener),
    ctx.remote.$on("settings/document-updated", listener),
    ctx.remote.$on("credentials/reference-updated", listener),
    ctx.on("connection/reset", listener)
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
async function jsonRequest(path, method, body, signal) {
  const response = await fetch(path, {
    method,
    headers: { accept: "application/json", ...body === void 0 ? {} : { "content-type": "application/json" } },
    credentials: "same-origin",
    cache: "no-store",
    signal,
    ...body === void 0 ? {} : { body: JSON.stringify(body) }
  });
  const value = await response.json().catch(() => void 0);
  if (!response.ok) {
    const message = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return value;
}
function loadSettingsSnapshot(signal) {
  return jsonRequest(SETTINGS_SNAPSHOT_PATH, "GET", void 0, signal);
}
function saveSettingsOverlay(overlay) {
  return jsonRequest(SETTINGS_SAVE_PATH, "PUT", { overlay });
}
function saveSettingsDefault(potetoDefault) {
  return jsonRequest(SETTINGS_SAVE_PATH, "PUT", { potetoDefault });
}
function readPotetoState(sessionId, signal) {
  return jsonRequest(`${POTETO_STATE_PATH}?session=${encodeURIComponent(sessionId)}`, "GET", void 0, signal);
}
function setPotetoState(sessionId, enabled) {
  return jsonRequest(POTETO_STATE_PATH, "POST", { session: sessionId, enabled });
}

// harness/pstack/dsh/src/client/PstackSettings.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var GROUPS = [
  { id: "groupDelegates", roles: ["feature, refactoring", "bug-fix", "perf-issue", "hillclimb"] },
  { id: "groupJudgment", roles: ["judgment and prose"] },
  { id: "groupPanels", roles: [...PANEL_ROLES] }
];
var VISIBLE_ROLES = GROUPS.flatMap((group) => group.roles);
var DESCRIPTION_KEY = {
  "feature, refactoring": "descFeatureRefactoring",
  "bug-fix": "descBugFix",
  "perf-issue": "descPerfIssue",
  hillclimb: "descHillclimb",
  "judgment and prose": "descJudgment",
  "arena runners": "descArenaRunners",
  "arena cross-judge pool": "descArenaJudge",
  "swarm workers": "descSwarmWorkers",
  "interrogate reviewers": "descInterrogateReviewers"
};
var SETTINGS_CSS = `
.pstack-page {
  display:flex; flex-direction:column; gap:24px; width:100%; max-width:960px;
  font-family:var(--dsw-font-family); color:var(--dsw-alias-label-primary);
}

.pstack-section { display:flex; flex-direction:column; gap:12px; }
.pstack-head { display:flex; flex-direction:column; gap:4px; }
.pstack-section-head { display:flex; align-items:baseline; gap:10px; }
.pstack-section-title { margin:0; font-size:14px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-section-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.pstack-intro { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); }

.pstack-tools { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.pstack-search { position:relative; display:flex; flex:1 1 200px; align-items:center; min-width:140px; color:var(--dsw-alias-label-tertiary); }
.pstack-search > svg { position:absolute; left:10px; pointer-events:none; }
.pstack-search input {
  box-sizing:border-box; width:100%; height:32px; padding:0 10px 0 32px;
  border:0.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font-family:inherit; font-size:13px; line-height:20px;
  transition:border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}
.pstack-search input::placeholder { color:var(--dsw-alias-label-dimmed); }
.pstack-search input:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.pstack-search input:focus-visible {
  outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset:1px;
}

.pstack-select-wrap { position:relative; display:inline-flex; align-items:center; width:100%; min-width:0; }
.pstack-select-wrap--auto { flex:0 1 220px; width:auto; min-width:160px; max-width:240px; }
.pstack-select-chevron {
  position:absolute; right:8px; pointer-events:none; color:var(--dsw-alias-label-tertiary);
  transition:color var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}
.pstack-select {
  box-sizing:border-box; appearance:none; width:100%; height:32px; min-width:0; padding:0 28px 0 10px;
  border:0.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font-family:inherit; font-size:13px; line-height:20px; cursor:pointer;
  text-overflow:ellipsis;
  transition:border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out), background var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}
.pstack-select:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.pstack-select:focus-visible {
  outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset:1px;
}
.pstack-select:disabled { opacity:.5; color:var(--dsw-alias-label-tertiary); cursor:default; }
.pstack-select:disabled + .pstack-select-chevron { opacity:.5; }
@media (hover:hover) {
  .pstack-search input:hover:not(:focus) { border-color:var(--dsw-alias-border-selected); }
  .pstack-select:hover:not(:disabled):not(:focus) {
    background:var(--dsw-alias-interactive-bg-hover); border-color:var(--dsw-alias-border-selected);
  }
}

.pstack-default-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px; padding:12px 16px; }
.pstack-default-text { display:flex; flex:1 1 220px; flex-direction:column; gap:2px; min-width:0; }
.pstack-default-label { font-size:13px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-default-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-group { display:flex; flex-direction:column; gap:8px; }
.pstack-group-head { display:flex; align-items:baseline; gap:10px; }
.pstack-group-title { margin:0; font-size:14px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-group-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.pstack-hint { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-card {
  border:0.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl);
  background:var(--dsw-alias-settings-card-fill); overflow:hidden;
}
.pstack-card > * + * { border-top:0.5px solid var(--dsw-alias-border-l2); }

.pstack-row {
  display:grid; grid-template-columns:minmax(0,1fr) minmax(200px,320px) minmax(116px,136px);
  gap:12px; align-items:center; padding:10px 16px;
}
.pstack-id { display:flex; flex-direction:column; gap:2px; min-width:0; }
.pstack-id-line { display:flex; align-items:center; gap:8px; min-width:0; }
.pstack-role {
  min-width:0; font-family:var(--ds-font-family-code); font-size:13px; line-height:20px; font-weight:500;
  color:var(--dsw-alias-label-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pstack-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-spacer { min-height:1px; }
.pstack-inline { display:flex; align-items:center; gap:8px; min-width:0; }

.pstack-panel-head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; padding:10px 16px; }
.pstack-panel-body { display:flex; flex-direction:column; gap:8px; margin:0 16px 14px; padding:12px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); }
.pstack-panel-body > .pstack-add { align-self:flex-start; }
.pstack-route-row { display:grid; grid-template-columns:18px minmax(0,1fr) minmax(116px,136px) auto; gap:8px; align-items:center; }
.pstack-index { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); text-align:right; font-variant-numeric:tabular-nums; }
/* Later than the shared Button rules and more specific, so the icon-only row action keeps its 28px box. */
.pstack-remove.pstack-remove { width:28px; min-width:28px; padding:0; color:var(--dsw-alias-label-tertiary); }
@media (hover:hover) {
  .pstack-remove.pstack-remove:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); color:var(--dsw-alias-state-error-primary); }
}

.pstack-foot { display:flex; flex-direction:column; gap:8px; padding-top:4px; }
.pstack-foot-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; }
.pstack-status { display:flex; align-items:center; gap:6px; min-width:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-status-text { color:var(--dsw-alias-label-secondary); }
.pstack-foot-actions { display:flex; gap:8px; align-items:center; margin-left:auto; }

.pstack-note { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); }
.pstack-banner { margin:0; border-radius:var(--dsw-radius-md); padding:8px 12px; font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.pstack-banner--warn { background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent); color:var(--dsw-alias-state-warn-label); }
.pstack-banner--ok { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); color:var(--dsw-alias-state-success-primary); }
.pstack-banner--error { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }

@media (pointer:coarse) {
  .pstack-search input, .pstack-select { font-size:16px; }
}

@media (width <= 640px) {
  .pstack-row { grid-template-columns:1fr; gap:8px; padding:12px 14px; }
  .pstack-panel-head { grid-template-columns:1fr; gap:8px; padding:12px 14px; }
  .pstack-panel-body { margin:0 14px 12px; }
  .pstack-default-row { padding:12px 14px; }
  .pstack-route-row { grid-template-columns:minmax(0,1fr) minmax(100px,auto) auto; }
  .pstack-index { display:none; }
}
`;
function overlaysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function firstRoute(routes) {
  const route = routes[0];
  if (route === void 0) return void 0;
  return { provider: route.provider, model: route.model };
}
function roleId(role) {
  return role.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "");
}
function SearchIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "7", cy: "7", r: "4.25", fill: "none", stroke: "currentColor", strokeWidth: "1.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M10.2 10.2 13.5 13.5", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })
  ] });
}
function ChevronDownIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { className: "pstack-select-chevron", width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4.5 6.25 8 9.75l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function RoleId({
  role,
  descId,
  t,
  trailing
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-id", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pstack-id-line", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: "pstack-role", children: role }),
      trailing
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-desc", id: descId, children: t(DESCRIPTION_KEY[role]) })
  ] });
}
function EffortSelect({
  id,
  label,
  describedBy,
  route,
  live,
  t,
  disabled,
  onChange
}) {
  const found = liveFor(live, route.provider, route.model);
  if (found === void 0 || found.efforts.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-spacer" });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pstack-select-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "select",
      {
        id,
        className: "pstack-select",
        "aria-label": label,
        "aria-describedby": describedBy,
        value: route.reasoningEffort ?? "",
        disabled,
        onChange: (event) => {
          const value = event.target.value;
          onChange(value.length === 0 ? { provider: route.provider, model: route.model } : { provider: route.provider, model: route.model, reasoningEffort: value });
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("effortOmit") }),
          route.reasoningEffort !== void 0 && !found.efforts.some((effort) => effort.id === route.reasoningEffort) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: route.reasoningEffort, disabled: true, children: [
            route.reasoningEffort,
            " \xB7 ",
            t("unavailable")
          ] }) : null,
          found.efforts.map((effort) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: effort.id, children: effort.name || effort.id }, effort.id))
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, {})
  ] });
}
function RouteSelect({
  id,
  label,
  describedBy,
  value,
  live,
  t,
  disabled,
  onChange
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pstack-select-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "select",
      {
        id,
        className: "pstack-select",
        "aria-label": label,
        "aria-describedby": describedBy,
        value,
        disabled,
        onChange: (event) => {
          onChange(event.target.value);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "inherit-parent", children: t("inheritParent") }),
          value !== "inherit-parent" && value !== "auto" && !live.some((route) => routeKey(route.provider, route.model) === value) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value, disabled: true, children: [
            value.replace("::", "/"),
            " \xB7 ",
            t("unavailable")
          ] }) : null,
          live.map((route) => {
            const key = routeKey(route.provider, route.model);
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: key, children: [
              route.provider,
              "/",
              route.model
            ] }, key);
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, {})
  ] });
}
function PstackSettings({ t, subscribeCatalogChanges }) {
  const [drafts, setDrafts] = (0, import_react2.useState)(void 0);
  const [saved, setSaved] = (0, import_react2.useState)(void 0);
  const [savedDefault, setSavedDefault] = (0, import_react2.useState)(void 0);
  const [draftDefault, setDraftDefault] = (0, import_react2.useState)(void 0);
  const [live, setLive] = (0, import_react2.useState)([]);
  const [dropped, setDropped] = (0, import_react2.useState)([]);
  const [error, setError] = (0, import_react2.useState)(void 0);
  const [catalogError, setCatalogError] = (0, import_react2.useState)(void 0);
  const [notice, setNotice] = (0, import_react2.useState)(void 0);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [refreshing, setRefreshing] = (0, import_react2.useState)(false);
  const [query, setQuery] = (0, import_react2.useState)("");
  const initialized = (0, import_react2.useRef)(false);
  const catalogRequest = (0, import_react2.useRef)(void 0);
  const refresh = (0, import_react2.useCallback)(async () => {
    catalogRequest.current?.abort();
    const request = new AbortController();
    catalogRequest.current = request;
    setRefreshing(true);
    try {
      const snapshot = await loadSettingsSnapshot(request.signal);
      if (request.signal.aborted) return;
      setLive(snapshot.catalog.routes);
      if (!initialized.current) {
        setSaved(snapshot.overlay);
        setDrafts(overlayToDraft(snapshot.overlay));
        setSavedDefault(snapshot.potetoDefault);
        setDraftDefault(snapshot.potetoDefault);
        setDropped(snapshot.droppedRoles);
        initialized.current = true;
      }
      setCatalogError(void 0);
    } catch (caught) {
      if (!request.signal.aborted) {
        setCatalogError(caught instanceof Error ? caught.message : t("requestFailed"));
      }
    } finally {
      if (catalogRequest.current === request) setRefreshing(false);
    }
  }, [t]);
  (0, import_react2.useEffect)(() => {
    const reload = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const stop = subscribeCatalogChanges(reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visible);
    reload();
    return () => {
      stop();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", visible);
      catalogRequest.current?.abort();
    };
  }, [refresh, subscribeCatalogChanges]);
  const currentOverlay = (0, import_react2.useMemo)(() => drafts === void 0 ? void 0 : draftToOverlay(drafts), [drafts]);
  const rolesDirty = saved !== void 0 && currentOverlay !== void 0 && !overlaysEqual(saved, currentOverlay);
  const defaultDirty = savedDefault !== void 0 && draftDefault !== void 0 && savedDefault !== draftDefault;
  const dirty = rolesDirty || defaultDirty;
  const empty = live.length === 0;
  const configured = drafts === void 0 ? 0 : drafts.filter((draft) => VISIBLE_ROLES.includes(draft.role) && !draft.inherit && draft.routes.length > 0).length;
  const total = VISIBLE_ROLES.length;
  const patchRole = (role, update) => {
    setDrafts((current) => current?.map((draft) => draft.role === role ? update(draft) : draft));
    setNotice(void 0);
    setError(void 0);
  };
  const setScalarChoice = (role, value) => {
    const parsed = parseRouteSelectValue(value, live);
    patchRole(role, (draft) => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] };
      }
      return { ...draft, inherit: false, inheritChoice: "inherit-parent", routes: [stripIllegalEffort(parsed.route, live)] };
    });
  };
  const setPanelChoice = (role, index, value) => {
    const parsed = parseRouteSelectValue(value, live);
    patchRole(role, (draft) => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] };
      }
      const routes = draft.inherit ? [] : [...draft.routes];
      routes[index] = stripIllegalEffort(parsed.route, live);
      return { ...draft, inherit: false, inheritChoice: "inherit-parent", routes };
    });
  };
  const save = async () => {
    if (currentOverlay === void 0 || draftDefault === void 0) return;
    setBusy(true);
    setNotice(void 0);
    setError(void 0);
    const failures = [];
    let savedAny = false;
    if (rolesDirty) {
      try {
        const result = await saveSettingsOverlay(currentOverlay);
        setSaved(result.overlay);
        setDrafts(overlayToDraft(result.overlay));
        setDropped([]);
        savedAny = true;
      } catch (caught) {
        failures.push(`${t("title")}: ${caught instanceof Error ? caught.message : t("requestFailed")}`);
      }
    }
    if (defaultDirty) {
      try {
        const result = await saveSettingsDefault(draftDefault);
        setSavedDefault(result.potetoDefault);
        setDraftDefault(result.potetoDefault);
        savedAny = true;
      } catch (caught) {
        failures.push(`${t("defaultsTitle")}: ${caught instanceof Error ? caught.message : t("requestFailed")}`);
      }
    }
    if (failures.length > 0) {
      setError([...savedAny ? [t("partiallySaved")] : [], ...failures].join("\n"));
    } else {
      setNotice(t("saved"));
    }
    setBusy(false);
  };
  const discard = () => {
    if (saved === void 0) return;
    setDrafts(overlayToDraft(saved));
    setDraftDefault(savedDefault);
    setDropped([]);
    setNotice(void 0);
    setError(void 0);
  };
  const matches = (role) => {
    if (query.trim().length === 0) return true;
    const needle = query.trim().toLowerCase();
    if (role.includes(needle)) return true;
    if (t(DESCRIPTION_KEY[role]).toLowerCase().includes(needle)) return true;
    const draft = drafts?.find((entry) => entry.role === role);
    return draft?.routes.some((route) => `${route.provider}/${route.model}`.toLowerCase().includes(needle) || route.reasoningEffort?.toLowerCase().includes(needle)) === true;
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "section",
    {
      className: "pstack-page",
      "aria-busy": busy || refreshing,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: SETTINGS_CSS }),
        drafts === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pstack-section", "aria-label": t("title"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-section-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "pstack-section-title", children: t("title") }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-intro", children: t("intro") })
          ] }),
          catalogError === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-note", role: "status", "aria-busy": "true", children: t("loading") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--error", role: "alert", children: catalogError }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-inline", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", onClick: () => {
              void refresh();
            }, children: t("reload") }) })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pstack-section", "aria-label": t("defaultsTitle"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-section-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "pstack-section-title", children: t("defaultsTitle") }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-card", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-default-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-default-text", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-default-label", children: t("potetoDefaultLabel") }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-default-desc", children: t("potetoDefaultDescription") })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                import_dsh_client_ui_primitives2.Switch,
                {
                  checked: draftDefault ?? false,
                  disabled: busy || draftDefault === void 0,
                  label: t("potetoDefaultLabel"),
                  onChange: (next) => {
                    setDraftDefault(next);
                    setNotice(void 0);
                    setError(void 0);
                  }
                }
              )
            ] }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pstack-section", "aria-label": t("title"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-section-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "pstack-section-title", children: t("title") }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-section-count", children: t("configured", { configured, total }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-intro", children: t("intro") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-tools", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pstack-search", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SearchIcon, {}),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "input",
                  {
                    type: "search",
                    placeholder: t("search"),
                    "aria-label": t("search"),
                    value: query,
                    onChange: (event) => setQuery(event.target.value)
                  }
                )
              ] }),
              !empty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pstack-select-wrap pstack-select-wrap--auto", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "select",
                  {
                    className: "pstack-select",
                    "aria-label": t("applyAll"),
                    defaultValue: "",
                    disabled: busy,
                    onChange: (event) => {
                      const value = event.target.value;
                      event.target.value = "";
                      if (value.length === 0) return;
                      if (value === "inherit-parent") {
                        setDrafts((current) => current === void 0 ? current : applyInheritAll(current));
                        return;
                      }
                      const parsed = parseRouteSelectValue(value, live);
                      if (parsed.inherit) {
                        setDrafts((current) => current === void 0 ? current : applyInheritAll(current, parsed.inheritChoice));
                        return;
                      }
                      setDrafts((current) => current === void 0 ? current : applyRouteToAll(current, parsed.route, live));
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("applyAll") }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "inherit-parent", children: t("applyAllInherit") }),
                      live.map((route) => {
                        const key = routeKey(route.provider, route.model);
                        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: key, children: [
                          route.provider,
                          "/",
                          route.model
                        ] }, key);
                      })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, {})
              ] }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                import_dsh_client_ui_primitives2.Button,
                {
                  variant: "outline",
                  size: "sm",
                  title: t("catalogUpdates"),
                  disabled: busy || refreshing,
                  onClick: () => {
                    void refresh();
                  },
                  children: refreshing ? t("reloading") : t("reload")
                }
              )
            ] }),
            catalogError !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--error", role: "alert", children: catalogError }) : null,
            empty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--warn", children: t("emptyCatalog") }) : null,
            dropped.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--warn", children: t("dropped") }) : null
          ] }),
          GROUPS.map((group) => {
            const roles = group.roles.filter(matches);
            if (roles.length === 0) return null;
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pstack-group", "aria-label": t(group.id), children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-group-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "pstack-group-title", children: t(group.id) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-group-count", children: roles.length })
              ] }),
              group.id === "groupPanels" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-hint", children: t("panelHint") }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-card", children: roles.map((role) => {
                const draft = drafts.find((entry) => entry.role === role);
                if (draft === void 0) return null;
                const controlId = roleId(role);
                if (!draft.panel) {
                  const route = draft.routes[0];
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RoleId, { role, descId: `pstack-desc-${controlId}`, t }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      RouteSelect,
                      {
                        id: `pstack-role-${controlId}`,
                        describedBy: `pstack-desc-${controlId}`,
                        label: `${role} \xB7 ${t("route")}`,
                        value: routeSelectValue(draft),
                        live,
                        t,
                        disabled: busy,
                        onChange: (value) => {
                          setScalarChoice(role, value);
                        }
                      }
                    ),
                    route !== void 0 && !draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      EffortSelect,
                      {
                        id: `pstack-effort-${controlId}`,
                        label: `${role} \xB7 ${t("effort")}`,
                        describedBy: `pstack-desc-${controlId}`,
                        route,
                        live,
                        t,
                        disabled: busy,
                        onChange: (next) => {
                          patchRole(role, (current) => ({ ...current, routes: [next] }));
                        }
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-spacer" })
                  ] }, role);
                }
                const rows = draft.inherit ? [] : draft.routes;
                return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-panel-head", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      RoleId,
                      {
                        role,
                        descId: `pstack-desc-${controlId}`,
                        t,
                        trailing: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { tone: draft.inherit ? "quiet" : "neutral", children: draft.inherit ? t("inherit") : t("panelRoutes", { count: rows.length }) })
                      }
                    ),
                    draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      import_dsh_client_ui_primitives2.Button,
                      {
                        variant: "outline",
                        size: "sm",
                        disabled: busy || empty,
                        onClick: () => {
                          const added = firstRoute(live);
                          if (added === void 0) return;
                          patchRole(role, (current) => ({ ...current, inherit: false, routes: [added] }));
                        },
                        children: t("configureRoutes")
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      import_dsh_client_ui_primitives2.Button,
                      {
                        variant: "ghost",
                        size: "sm",
                        disabled: busy,
                        onClick: () => {
                          patchRole(role, (current) => ({ ...current, inherit: true, inheritChoice: "inherit-parent", routes: [] }));
                        },
                        children: t("inherit")
                      }
                    )
                  ] }),
                  draft.inherit ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-panel-body", children: [
                    rows.map((route, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-route-row", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-index", "aria-hidden": "true", children: index + 1 }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        RouteSelect,
                        {
                          id: `pstack-panel-${controlId}-${index}`,
                          label: `${role} ${index + 1} \xB7 ${t("route")}`,
                          describedBy: `pstack-desc-${controlId}`,
                          value: routeSelectValue({ ...draft, inherit: false, routes: [route] }),
                          live,
                          t,
                          disabled: busy || empty,
                          onChange: (value) => {
                            setPanelChoice(role, index, value);
                          }
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        EffortSelect,
                        {
                          id: `pstack-panel-effort-${controlId}-${index}`,
                          label: `${role} ${index + 1} \xB7 ${t("effort")}`,
                          describedBy: `pstack-desc-${controlId}`,
                          route,
                          live,
                          t,
                          disabled: busy,
                          onChange: (next) => {
                            patchRole(role, (current) => {
                              const nextRoutes = [...current.routes];
                              nextRoutes[index] = next;
                              return { ...current, inherit: false, routes: nextRoutes };
                            });
                          }
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          variant: "ghost",
                          size: "sm",
                          className: "pstack-remove",
                          icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconTrashOutlineRegular, { size: 14, "aria-hidden": "true" }),
                          "aria-label": t("removeRoute"),
                          title: t("removeRoute"),
                          disabled: busy,
                          onClick: () => {
                            patchRole(role, (current) => {
                              const nextRoutes = current.routes.filter((_, item) => item !== index);
                              return nextRoutes.length === 0 ? { ...current, inherit: true, routes: [] } : { ...current, inherit: false, routes: nextRoutes };
                            });
                          }
                        }
                      )
                    ] }, `${role}-${index}`)),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      import_dsh_client_ui_primitives2.Button,
                      {
                        variant: "outline",
                        size: "sm",
                        className: "pstack-add",
                        title: t("addRouteHint"),
                        icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconPlusOutlineRegular, { size: 14, "aria-hidden": "true" }),
                        disabled: busy || empty,
                        onClick: () => {
                          const added = firstRoute(live);
                          if (added === void 0) return;
                          patchRole(role, (current) => ({
                            ...current,
                            inherit: false,
                            routes: [...current.inherit ? [] : current.routes, added]
                          }));
                        },
                        children: t("addRoute")
                      }
                    )
                  ] })
                ] }, role);
              }) })
            ] }, group.id);
          }),
          GROUPS.every((group) => group.roles.filter(matches).length === 0) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-note", children: t("noMatch") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "pstack-foot", children: [
            error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--error", role: "alert", children: error }) : null,
            notice !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-banner pstack-banner--ok", role: "status", children: notice }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-foot-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-status", role: "status", "aria-live": "polite", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: dirty ? "warning" : "idle" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-status-text", children: dirty ? t("dirty") : t("clean") })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-foot-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", size: "md", disabled: busy || !dirty, onClick: discard, children: t("discard") }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", size: "md", disabled: busy || !dirty, onClick: () => {
                  void save();
                }, children: busy ? t("saving") : t("save") })
              ] })
            ] })
          ] })
        ] })
      ]
    }
  );
}

// harness/pstack/dsh/src/client/locales.ts
var en = {
  title: "pstack roles",
  intro: "Pick a model for each role. Roles without a route inherit this conversation.",
  defaultsTitle: "Defaults",
  potetoDefaultLabel: "Enable the poteto workflow in new sessions",
  potetoDefaultDescription: "New sessions start with the workflow on. Open sessions keep their own switch.",
  loading: "Loading models\u2026",
  search: "Search roles",
  route: "Model",
  configured: "{configured} of {total} configured",
  dirty: "Unsaved changes",
  clean: "Saved",
  discard: "Discard",
  inherit: "Inherit",
  configureRoutes: "Add routes",
  panelRoutes: "{count} routes",
  noMatch: "No role matches that search.",
  effort: "Effort",
  effortOmit: "Adapter default",
  unavailable: "no longer listed",
  addRoute: "Add route",
  removeRoute: "Remove route",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Changes saved.",
  partiallySaved: "Some changes were saved. Failed changes remain unsaved.",
  reload: "Refresh",
  reloading: "Refreshing\u2026",
  catalogUpdates: "The list follows DSH model changes and keeps unsaved edits.",
  applyAll: "Apply to all roles",
  applyAllInherit: "Inherit for every role",
  inheritParent: "inherit-parent",
  emptyCatalog: "DSH lists no models. Every role inherits this conversation.",
  dropped: "Some saved routes are no longer listed by DSH. Those roles inherit until you save again.",
  requestFailed: "The settings request failed.",
  switchLabel: "poteto workflow",
  switchDescription: "On: this session gets the pstack tools and skills, and native subagent tools are denied so delegation goes through pstack_spawn and the role mapping. Off: the plugin adds no tools, skills, or prompt to this session.",
  switchInfoLabel: "About the poteto workflow switch",
  groupDelegates: "Code delegates",
  groupJudgment: "Judgment and prose",
  groupPanels: "Panel roles",
  panelHint: "Each route starts one child agent.",
  addRouteHint: "Adds the first listed model; change it afterwards.",
  descFeatureRefactoring: "New behavior and behavior-preserving structure",
  descBugFix: "Reproduce and fix a defect",
  descPerfIssue: "Trace and improve a slow path",
  descHillclimb: "Lift one metric over many rounds",
  descJudgment: "Judgment calls and prose",
  descArenaRunners: "Parallel attempts at one artifact",
  descArenaJudge: "Cross-judge pool, one runs",
  descSwarmWorkers: "Parallel coverage workers",
  descInterrogateReviewers: "Adversarial multi-model review"
};
var zh = {
  title: "pstack \u89D2\u8272",
  intro: "\u4E3A\u6BCF\u4E2A\u89D2\u8272\u9009\u62E9\u6A21\u578B\u3002\u672A\u914D\u7F6E\u7684\u89D2\u8272\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002",
  defaultsTitle: "\u9ED8\u8BA4\u914D\u7F6E",
  potetoDefaultLabel: "\u65B0\u4F1A\u8BDD\u9ED8\u8BA4\u542F\u7528 poteto \u5DE5\u4F5C\u6D41",
  potetoDefaultDescription: "\u4FDD\u5B58\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\u81EA\u52A8\u5F00\u542F poteto \u5DE5\u4F5C\u6D41\uFF1B\u5DF2\u6253\u5F00\u7684\u4F1A\u8BDD\u4FDD\u6301\u81EA\u5DF1\u7684\u5F00\u5173\u72B6\u6001\u3002",
  loading: "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u2026",
  search: "\u641C\u7D22\u89D2\u8272",
  route: "\u6A21\u578B",
  configured: "\u5DF2\u914D\u7F6E {configured} / {total}",
  dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u66F4\u6539",
  clean: "\u5DF2\u4FDD\u5B58",
  discard: "\u8FD8\u539F",
  inherit: "\u7EE7\u627F",
  configureRoutes: "\u914D\u7F6E\u591A\u8DEF",
  panelRoutes: "{count} \u8DEF",
  noMatch: "\u6CA1\u6709\u5339\u914D\u7684\u89D2\u8272\u3002",
  effort: "\u63A8\u7406\u6863\u4F4D",
  effortOmit: "\u9002\u914D\u5668\u9ED8\u8BA4",
  unavailable: "\u5DF2\u4E0D\u5728\u5217\u8868",
  addRoute: "\u6DFB\u52A0\u8DEF\u7531",
  removeRoute: "\u79FB\u9664\u8DEF\u7531",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u66F4\u6539\u5DF2\u4FDD\u5B58\u3002",
  partiallySaved: "\u90E8\u5206\u66F4\u6539\u5DF2\u4FDD\u5B58\u3002\u5931\u8D25\u7684\u9879\u76EE\u4ECD\u672A\u4FDD\u5B58\uFF0C\u53EF\u91CD\u8BD5\u6216\u8FD8\u539F\u3002",
  reload: "\u5237\u65B0",
  reloading: "\u5237\u65B0\u4E2D\u2026",
  catalogUpdates: "\u5217\u8868\u968F DSH \u6A21\u578B\u53D8\u5316\u81EA\u52A8\u66F4\u65B0\uFF0C\u4E0D\u4F1A\u8986\u76D6\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\u3002",
  applyAll: "\u5E94\u7528\u5230\u5168\u90E8\u89D2\u8272",
  applyAllInherit: "\u5168\u90E8\u89D2\u8272\u6539\u4E3A\u7EE7\u627F",
  inheritParent: "\u7EE7\u627F\u7236\u5BF9\u8BDD",
  emptyCatalog: "DSH \u6CA1\u6709\u5217\u51FA\u4EFB\u4F55\u6A21\u578B\uFF0C\u6240\u6709\u89D2\u8272\u90FD\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002",
  dropped: "\u90E8\u5206\u5DF2\u4FDD\u5B58\u7684\u8DEF\u7531\u5DF2\u4E0D\u5728 DSH \u5217\u8868\u4E2D\uFF0C\u8FD9\u4E9B\u89D2\u8272\u5728\u4F60\u91CD\u65B0\u4FDD\u5B58\u524D\u4F1A\u6539\u4E3A\u7EE7\u627F\u3002",
  requestFailed: "\u8BBE\u7F6E\u8BF7\u6C42\u5931\u8D25\u3002",
  switchLabel: "poteto \u5DE5\u4F5C\u6D41",
  switchDescription: "\u5F00\u542F\u540E\u672C\u4F1A\u8BDD\u83B7\u5F97 pstack \u5DE5\u5177\u4E0E skill\uFF0C\u5E76\u7981\u7528\u539F\u751F subagent\uFF0C\u59D4\u6D3E\u8D70 pstack_spawn \u4E0E\u89D2\u8272\u6620\u5C04\uFF1B\u5173\u95ED\u540E\u672C\u4F1A\u8BDD\u4E0D\u4F7F\u7528 pstack \u7684\u4EFB\u4F55\u5DE5\u5177\u3001skill \u6216\u63D0\u793A\u3002",
  switchInfoLabel: "\u5173\u4E8E poteto \u5DE5\u4F5C\u6D41\u5F00\u5173",
  groupDelegates: "\u4EE3\u7801\u59D4\u6D3E",
  groupJudgment: "\u5224\u65AD\u4E0E\u5199\u4F5C",
  groupPanels: "\u9762\u677F\u89D2\u8272",
  panelHint: "\u6BCF\u6761\u8DEF\u7531\u5404\u542F\u52A8\u4E00\u4E2A\u5B50 agent\u3002",
  addRouteHint: "\u5148\u52A0\u5165\u5217\u8868\u91CC\u7684\u7B2C\u4E00\u6761\uFF0C\u518D\u6539\u6210\u4F60\u8981\u7684\u6A21\u578B\u3002",
  descFeatureRefactoring: "\u65B0\u529F\u80FD\u4E0E\u4E0D\u6539\u884C\u4E3A\u7684\u7ED3\u6784\u8C03\u6574",
  descBugFix: "\u590D\u73B0\u5E76\u4FEE\u597D\u7F3A\u9677",
  descPerfIssue: "\u5B9A\u4F4D\u5E76\u6539\u5584\u6162\u8DEF\u5F84",
  descHillclimb: "\u591A\u8F6E\u63D0\u5347\u540C\u4E00\u6307\u6807",
  descJudgment: "\u5224\u65AD\u53D6\u820D\u4E0E\u6587\u6848\u5199\u4F5C",
  descArenaRunners: "\u540C\u4E00\u4EA7\u7269\u7684\u5E76\u884C\u5C1D\u8BD5",
  descArenaJudge: "\u4EA4\u53C9\u8BC4\u5BA1\u6C60\uFF0C\u53EA\u8DD1\u4E00\u4F4D",
  descSwarmWorkers: "\u5E76\u884C\u8986\u76D6\u7684\u6267\u884C\u5DE5\u4EBA",
  descInterrogateReviewers: "\u591A\u6A21\u578B\u5BF9\u6297\u8BC4\u5BA1"
};

// harness/pstack/dsh/src/client/index.tsx
var name = "dsh-pstack-client";
var inject = ["slots", "locale", "remote"];
function apply(ctx) {
  const namespace = "settings.pstack";
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), "dsh-pstack: editor copy");
  const t = ctx.locale.bind(namespace);
  const subscribeCatalogChanges = (listener) => listenForCatalogChanges(ctx, listener);
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: PLUGIN_ID,
    locale: namespace,
    inject: () => ({ t, subscribeCatalogChanges })
  }, PstackSettings));
  const switchSlot = "conversation.input.model.options";
  ctx.slots.inject(switchSlot, () => ctx.slots.register({
    name: switchSlot,
    id: "pstack-poteto-switch",
    locale: namespace,
    inject: (sessionId) => ({
      sessionId,
      t,
      readMode: async () => (await readPotetoState(sessionId)).enabled,
      selectMode: async (enabled) => {
        try {
          await setPotetoState(sessionId, enabled);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "switch failed";
        }
      }
    })
  }, PotetoToggle));
}

		return module.exports;
	}
});
