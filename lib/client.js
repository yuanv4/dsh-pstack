window.__ModuleLoader__.load({
	id: "pstack-dsh",
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

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react3 = require("react");

// src/client/PotetoToggle.tsx
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

// src/client/PstackSettings.tsx
var import_react2 = require("react");

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

// src/settings-draft.ts
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

// src/ids.ts
var PLUGIN_ID = "pstack-dsh";
var ROLE_EDITOR_ENTRY_ID = "pstack-role-settings";
var SETTINGS_SNAPSHOT_PATH = "/plugins/pstack-dsh/settings";
var SETTINGS_SAVE_PATH = "/plugins/pstack-dsh/settings";
var POTETO_STATE_PATH = "/plugins/pstack-dsh/poteto";

// src/client/api.ts
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
function readPotetoState(sessionId, signal) {
  return jsonRequest(`${POTETO_STATE_PATH}?session=${encodeURIComponent(sessionId)}`, "GET", void 0, signal);
}
function setPotetoState(sessionId, enabled) {
  return jsonRequest(POTETO_STATE_PATH, "POST", { session: sessionId, enabled });
}

// src/client/PstackSettings.tsx
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
.pstack-page { display:flex; flex-direction:column; flex:1 0 auto; color:var(--dsw-alias-label-primary); }
.pstack-page .pstack-button {
  flex:none; min-height:32px; padding:0 12px; border:1px solid transparent; border-radius:8px;
  background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer;
  white-space:nowrap;
}
.pstack-page .pstack-button--primary { background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-inverted); }
.pstack-page .pstack-button--outline { border-color:var(--dsw-alias-border-l2); }
.pstack-page .pstack-button--ghost { color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-button:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
.pstack-page .pstack-button:disabled { cursor:default; opacity:.45; }
@media (hover:hover) {
  .pstack-page .pstack-button--ghost:not(:disabled):hover,
  .pstack-page .pstack-button--outline:not(:disabled):hover { background:var(--dsw-alias-interactive-bg-hover); }
  .pstack-page .pstack-button--primary:not(:disabled):hover { background:var(--dsw-alias-button-primary-hover); }
}
.pstack-page .pstack-button:not(:disabled):active { background:var(--dsw-alias-interactive-bg-active); }

.pstack-page .pstack-tools {
  position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
  padding:10px 16px; background:var(--dsw-alias-bg-layer-2);
  border-bottom:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-page .pstack-search {
  flex:1 1 180px; min-width:120px; height:32px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2);
  border-radius:8px; background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px;
}
.pstack-page .pstack-search::placeholder { color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-search:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:-1px; }

.pstack-page .pstack-list { display:flex; flex-direction:column; flex:1 0 auto; gap:18px; padding:16px; }
.pstack-page .pstack-group { display:flex; flex-direction:column; gap:6px; }
.pstack-page .pstack-group-head { display:flex; align-items:baseline; gap:8px; padding:0 2px; }
.pstack-page .pstack-group-title { margin:0; font-size:12px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-group-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-page .pstack-card {
  border:0.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-md, 10px);
  background:var(--dsw-alias-settings-card-fill); overflow:hidden;
}
.pstack-page .pstack-card > * + * { border-top:0.5px solid var(--dsw-alias-border-l1); }

.pstack-page .pstack-row {
  display:grid; grid-template-columns:minmax(150px,1fr) minmax(170px,1.35fr) minmax(104px,132px);
  gap:10px; align-items:center; padding:7px 12px;
}
.pstack-page .pstack-id { display:flex; flex-direction:column; gap:1px; min-width:0; }
.pstack-page .pstack-role {
  font-size:13px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-primary);
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pstack-page .pstack-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstack-page .pstack-select {
  width:100%; height:32px; min-width:0; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px;
}
.pstack-page .pstack-select:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:-1px; }
.pstack-page .pstack-select:disabled { color:var(--dsw-alias-label-tertiary); cursor:default; }
.pstack-page .pstack-spacer { min-height:1px; }
.pstack-page .pstack-inline { display:flex; gap:6px; align-items:center; min-width:0; }

.pstack-page .pstack-panel-head {
  display:grid; grid-template-columns:minmax(150px,1fr) auto auto; gap:10px; align-items:center; padding:7px 12px;
}
.pstack-page .pstack-panel-head-main { display:flex; align-items:center; gap:8px; min-width:0; }
.pstack-page .pstack-badge {
  flex:none; padding:1px 7px; border-radius:999px; font-size:12px; line-height:18px;
  color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-3);
}
.pstack-page .pstack-panel-body { display:flex; flex-direction:column; gap:6px; padding:8px 12px 10px 24px; background:var(--dsw-alias-bg-layer-1); }
.pstack-page .pstack-route-row { display:grid; grid-template-columns:18px minmax(120px,1fr) minmax(96px,124px) auto; gap:8px; align-items:center; }
.pstack-page .pstack-index { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); text-align:right; }
.pstack-page .pstack-remove {
  flex:none; width:28px; height:28px; padding:0; border:1px solid transparent; border-radius:var(--dsw-radius-sm, 6px);
  background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:15px; line-height:1; cursor:pointer;
}
@media (hover:hover) { .pstack-page .pstack-remove:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.pstack-page .pstack-remove:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:1px; }

.pstack-page .pstack-foot {
  position:sticky; bottom:0; z-index:2; margin-top:auto;
  display:flex; flex-wrap:wrap; gap:10px; align-items:center;
  justify-content:space-between; padding:10px 16px;
  background:var(--dsw-alias-bg-layer-2); border-top:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-page .pstack-status { display:flex; align-items:center; gap:8px; min-width:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-dot { flex:none; width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-idle-primary); }
.pstack-page .pstack-dot--dirty { background:var(--dsw-alias-state-warn-primary); }
.pstack-page .pstack-status-text { color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-path { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px; }
.pstack-page .pstack-foot-error { flex:1 1 100%; margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }
.pstack-page .pstack-foot-ok { flex:1 1 100%; margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-success-primary); }
.pstack-page .pstack-select--auto { width:auto; }
.pstack-page .pstack-hint { margin:0; padding:0 2px; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-foot-actions { display:flex; gap:8px; align-items:center; margin-left:auto; }

.pstack-page .pstack-note { margin:0; padding:16px; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-warn { margin:0; padding:8px 16px; font-size:12px; line-height:18px; color:var(--dsw-alias-state-warn-label); }
.pstack-page .pstack-error { margin:0; padding:8px 16px; font-size:12px; line-height:18px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }

@media (width <= 720px) {
  .pstack-page .pstack-row { grid-template-columns:1fr; }
  .pstack-page .pstack-panel-head { grid-template-columns:1fr; }
  .pstack-page .pstack-route-row { grid-template-columns:minmax(0,1fr) auto auto; }
  .pstack-page .pstack-index { display:none; }
  .pstack-page .pstack-path { display:none; }
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
function RoleId({ role, descId, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-id", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: "pstack-role", children: role }),
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
  );
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
  );
}
function PstackSettings({ t, subscribeCatalogChanges, active = true }) {
  if (t === void 0) throw new Error("pstack settings requires its translation function");
  const [drafts, setDrafts] = (0, import_react2.useState)(void 0);
  const [saved, setSaved] = (0, import_react2.useState)(void 0);
  const [live, setLive] = (0, import_react2.useState)([]);
  const [path, setPath] = (0, import_react2.useState)("");
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
      setPath(snapshot.path);
      if (!initialized.current) {
        setSaved(snapshot.overlay);
        setDrafts(overlayToDraft(snapshot.overlay));
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
    if (!active) return;
    const reload = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const stop = subscribeCatalogChanges?.(reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visible);
    reload();
    return () => {
      stop?.();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", visible);
      catalogRequest.current?.abort();
    };
  }, [refresh, subscribeCatalogChanges, active]);
  const currentOverlay = (0, import_react2.useMemo)(() => drafts === void 0 ? void 0 : draftToOverlay(drafts), [drafts]);
  const dirty = saved !== void 0 && currentOverlay !== void 0 && !overlaysEqual(saved, currentOverlay);
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
    if (currentOverlay === void 0) return;
    setBusy(true);
    setNotice(void 0);
    setError(void 0);
    try {
      const result = await saveSettingsOverlay(currentOverlay);
      setSaved(result.overlay);
      setDrafts(overlayToDraft(result.overlay));
      setDropped([]);
      setError(void 0);
      setNotice(t("saved"));
    } catch (caught) {
      setNotice(void 0);
      setError(caught instanceof Error ? caught.message : t("requestFailed"));
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    if (saved === void 0) return;
    setDrafts(overlayToDraft(saved));
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
      onFocusCapture: (event) => {
        if (event.target instanceof HTMLSelectElement) void refresh();
      },
      onPointerDownCapture: (event) => {
        if (event.target instanceof HTMLSelectElement) void refresh();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: SETTINGS_CSS }),
        drafts === void 0 ? catalogError === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-note", role: "status", "aria-busy": "true", children: t("loading") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-error", role: "alert", children: catalogError }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-note", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pstack-button pstack-button--outline", onClick: () => {
            void refresh();
          }, children: t("reload") }) })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-tools", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                autoFocus: true,
                type: "search",
                className: "pstack-search",
                placeholder: t("search"),
                "aria-label": t("search"),
                value: query,
                onChange: (event) => setQuery(event.target.value)
              }
            ),
            !empty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "select",
              {
                className: "pstack-select pstack-select--auto",
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
            ) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "pstack-button pstack-button--outline",
                title: t("catalogUpdates"),
                "aria-busy": refreshing,
                disabled: busy || refreshing,
                onClick: () => {
                  void refresh();
                },
                children: refreshing ? t("reloading") : t("reload")
              }
            )
          ] }),
          catalogError !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-error", role: "alert", children: catalogError }) : null,
          empty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-warn", children: t("emptyCatalog") }) : null,
          dropped.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-warn", children: t("dropped") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-list", children: [
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
                  if (!draft.panel) {
                    const route = draft.routes[0];
                    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-row", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RoleId, { role, descId: `pstack-desc-${role}`, t }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        RouteSelect,
                        {
                          id: `pstack-role-${role}`,
                          describedBy: `pstack-desc-${role}`,
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
                          id: `pstack-effort-${role}`,
                          label: `${role} \xB7 ${t("effort")}`,
                          describedBy: `pstack-desc-${role}`,
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
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-panel-head-main", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RoleId, { role, descId: `pstack-desc-${role}`, t }),
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-badge", children: draft.inherit ? t("inherit") : t("panelRoutes", { count: rows.length }) })
                      ] }),
                      draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        RouteSelect,
                        {
                          label: `${role} \xB7 ${t("route")}`,
                          value: draft.inheritChoice,
                          live: [],
                          t,
                          disabled: busy,
                          onChange: (value) => {
                            if (value === "inherit-parent" || value === "auto") {
                              patchRole(role, (current) => ({ ...current, inherit: true, inheritChoice: value, routes: [] }));
                            }
                          }
                        }
                      ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-spacer" }),
                      draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "pstack-button pstack-button--ghost",
                          disabled: busy || empty,
                          onClick: () => {
                            const added = firstRoute(live);
                            if (added === void 0) return;
                            patchRole(role, (current) => ({ ...current, inherit: false, routes: [added] }));
                          },
                          children: t("configureRoutes")
                        }
                      ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "pstack-button pstack-button--ghost",
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
                            id: `pstack-panel-${role}-${index}`,
                            label: `${role} ${index + 1} \xB7 ${t("route")}`,
                            describedBy: `pstack-desc-${role}`,
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
                            id: `pstack-panel-effort-${role}-${index}`,
                            label: `${role} ${index + 1} \xB7 ${t("effort")}`,
                            describedBy: `pstack-desc-${role}`,
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
                          "button",
                          {
                            type: "button",
                            className: "pstack-remove",
                            "aria-label": t("removeRoute"),
                            title: t("removeRoute"),
                            disabled: busy,
                            onClick: () => {
                              patchRole(role, (current) => {
                                const nextRoutes = current.routes.filter((_, item) => item !== index);
                                return nextRoutes.length === 0 ? { ...current, inherit: true, routes: [] } : { ...current, inherit: false, routes: nextRoutes };
                              });
                            },
                            children: "\xD7"
                          }
                        )
                      ] }, `${role}-${index}`)),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pstack-inline", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "pstack-button pstack-button--outline",
                          title: t("addRouteHint"),
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
                      ) })
                    ] })
                  ] }, role);
                }) })
              ] }, group.id);
            }),
            GROUPS.every((group) => group.roles.filter(matches).length === 0) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-note", children: t("noMatch") }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "pstack-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-status", role: "status", "aria-live": "polite", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `pstack-dot${dirty ? " pstack-dot--dirty" : ""}`, "aria-hidden": "true" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-status-text", children: dirty ? t("dirty") : t("clean") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: "\xB7" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("configured", { configured, total }) }),
              path.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pstack-path", title: `${t("overlayPath")}: ${path}`, children: path }) : null
            ] }),
            error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-foot-error", role: "alert", children: error }) : null,
            notice !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pstack-foot-ok", role: "status", children: notice }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pstack-foot-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pstack-button pstack-button--ghost", disabled: busy || !dirty, onClick: discard, children: t("discard") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  className: "pstack-button pstack-button--outline",
                  disabled: busy,
                  onClick: () => {
                    setDrafts((current) => current === void 0 ? current : applyInheritAll(current));
                    setNotice(void 0);
                  },
                  children: t("resetAll")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pstack-button pstack-button--primary", disabled: busy || !dirty, onClick: () => {
                void save();
              }, children: busy ? t("saving") : t("save") })
            ] })
          ] })
        ] })
      ]
    }
  );
}

// src/client/locales.ts
var en = {
  nav: "Configure",
  title: "pstack roles",
  intro: "Pick a model for each role. Roles without a route inherit this conversation.",
  close: "Close",
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
  saved: "Saved. New child agents use this mapping.",
  reload: "Refresh",
  reloading: "Refreshing\u2026",
  catalogUpdates: "The list follows DSH model changes and keeps unsaved edits.",
  resetAll: "Inherit all",
  applyAll: "Apply to all roles",
  applyAllInherit: "Inherit for every role",
  inheritParent: "inherit-parent",
  emptyCatalog: "DSH lists no models. Every role inherits this conversation.",
  overlayPath: "Overlay",
  dropped: "Some saved routes are no longer listed by DSH. Those roles inherit until you save again.",
  requestFailed: "The settings request failed.",
  rolesAndModels: "pstack roles and models",
  switchLabel: "poteto workflow",
  switchDescription: "On: native subagent tools are denied for this session, so delegation goes through pstack_spawn and the role mapping. Off: native delegation bypasses the mapping.",
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
  nav: "\u914D\u7F6E",
  title: "pstack \u89D2\u8272",
  intro: "\u4E3A\u6BCF\u4E2A\u89D2\u8272\u9009\u62E9\u6A21\u578B\u3002\u672A\u914D\u7F6E\u7684\u89D2\u8272\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002",
  close: "\u5173\u95ED",
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
  saved: "\u5DF2\u4FDD\u5B58\u3002\u65B0\u542F\u52A8\u7684\u5B50 agent \u4F1A\u4F7F\u7528\u8FD9\u4EFD\u6620\u5C04\u3002",
  reload: "\u5237\u65B0",
  reloading: "\u5237\u65B0\u4E2D\u2026",
  catalogUpdates: "\u5217\u8868\u968F DSH \u6A21\u578B\u53D8\u5316\u81EA\u52A8\u66F4\u65B0\uFF0C\u4E0D\u4F1A\u8986\u76D6\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\u3002",
  resetAll: "\u5168\u90E8\u7EE7\u627F",
  applyAll: "\u5E94\u7528\u5230\u5168\u90E8\u89D2\u8272",
  applyAllInherit: "\u5168\u90E8\u89D2\u8272\u6539\u4E3A\u7EE7\u627F",
  inheritParent: "\u7EE7\u627F\u7236\u5BF9\u8BDD",
  emptyCatalog: "DSH \u6CA1\u6709\u5217\u51FA\u4EFB\u4F55\u6A21\u578B\uFF0C\u6240\u6709\u89D2\u8272\u90FD\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002",
  overlayPath: "\u914D\u7F6E\u6587\u4EF6",
  dropped: "\u90E8\u5206\u5DF2\u4FDD\u5B58\u7684\u8DEF\u7531\u5DF2\u4E0D\u5728 DSH \u5217\u8868\u4E2D\uFF0C\u8FD9\u4E9B\u89D2\u8272\u5728\u4F60\u91CD\u65B0\u4FDD\u5B58\u524D\u4F1A\u6539\u4E3A\u7EE7\u627F\u3002",
  requestFailed: "\u8BBE\u7F6E\u8BF7\u6C42\u5931\u8D25\u3002",
  rolesAndModels: "pstack \u89D2\u8272\u4E0E\u6A21\u578B",
  switchLabel: "poteto \u5DE5\u4F5C\u6D41",
  switchDescription: "\u5F00\u542F\u540E\u672C\u4F1A\u8BDD\u7981\u7528\u539F\u751F subagent\uFF0C\u59D4\u6D3E\u5FC5\u987B\u8D70 pstack_spawn \u4E0E\u89D2\u8272\u6620\u5C04\uFF1B\u5173\u95ED\u540E\u539F\u751F\u59D4\u6D3E\u4F1A\u7ED5\u8FC7\u6620\u5C04\u3002",
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

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "pstack-dsh-client";
var inject = ["slots", "locale", "remote"];
var CHROME_CSS = `
.pstack-trigger {
  flex:none; height:28px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm, 6px); background:transparent; color:var(--dsw-alias-label-primary);
  font:inherit; font-size:12px; line-height:18px; cursor:pointer;
}
.pstack-trigger:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
@media (hover:hover) { .pstack-trigger:hover { background:var(--dsw-alias-interactive-bg-hover); } }
.pstack-trigger:active { background:var(--dsw-alias-interactive-bg-active); }

.pstack-dialog {
  box-sizing:border-box; padding:0; overflow:hidden;
  width:min(860px, calc(100vw - 32px)); max-height:calc(100dvh - 48px);
  border:0; border-radius:var(--dsw-radius-panel, 16px);
  box-shadow:var(--dsw-elevation-prominent, 0 12px 32px rgb(0 0 0 / 24%));
  background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary);
}
/* Author display beats the UA rule for closed dialogs, so scope flex to the open state. */
.pstack-dialog[open] { display:flex; flex-direction:column; gap:0; }
.pstack-dialog:not([open]) { display:none; }
.pstack-dialog::backdrop { background:var(--dsw-alias-bg-mask-1, rgb(0 0 0 / 40%)); backdrop-filter:var(--dsw-mask-blur, blur(2px)); }
.pstack-dialog-head {
  flex:none; display:flex; align-items:flex-start; gap:12px;
  padding:16px 16px 12px; border-bottom:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-dialog-titles { display:flex; flex-direction:column; gap:2px; min-width:0; }
.pstack-dialog-title { margin:0; font-size:16px; line-height:24px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-dialog-sub { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-dialog-close {
  flex:none; margin-left:auto; display:grid; place-items:center; width:28px; height:28px; padding:0;
  border:1px solid transparent; border-radius:var(--dsw-radius-sm, 6px); background:transparent;
  color:var(--dsw-alias-label-secondary); cursor:pointer;
}
.pstack-dialog-close:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
@media (hover:hover) { .pstack-dialog-close:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.pstack-dialog-body { display:flex; flex-direction:column; flex:1 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain; }
`;
function CloseIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M2.5 2.5l9 9M11.5 2.5l-9 9", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) });
}
function PstackDetailAction({ subject, t, subscribeCatalogChanges }) {
  const dialog = (0, import_react3.useRef)(null);
  const titleId = (0, import_react3.useId)();
  const [mounted, setMounted] = (0, import_react3.useState)(false);
  const [open, setOpen] = (0, import_react3.useState)(false);
  if (subject.kind !== "bundle" || subject.pkg.name !== PLUGIN_ID) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("style", { children: CHROME_CSS }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        className: "pstack-trigger",
        title: t("rolesAndModels"),
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: () => {
          dialog.current?.showModal();
          setMounted(true);
          setOpen(true);
        },
        children: t("nav")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "dialog",
      {
        ref: dialog,
        className: "pstack-dialog",
        "aria-labelledby": titleId,
        "data-window-drag-exclude": "",
        onClose: () => setOpen(false),
        onClick: (event) => {
          if (event.target === dialog.current) dialog.current.close();
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "pstack-dialog-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pstack-dialog-titles", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { id: titleId, className: "pstack-dialog-title", children: t("title") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "pstack-dialog-sub", children: t("intro") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "pstack-dialog-close", "aria-label": t("close"), title: t("close"), onClick: () => dialog.current?.close(), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CloseIcon, {}) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pstack-dialog-body", children: mounted && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PstackSettings, { t, subscribeCatalogChanges, active: open }) })
        ]
      }
    )
  ] });
}
function apply(ctx) {
  const namespace = "settings.pstack";
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), "pstack-dsh: editor copy");
  const t = ctx.locale.bind(namespace);
  const subscribeCatalogChanges = (listener) => listenForCatalogChanges(ctx, listener);
  ctx.slots.inject("plugins.detail.actions", () => ctx.slots.register({
    name: "plugins.detail.actions",
    id: ROLE_EDITOR_ENTRY_ID,
    inject: () => ({ t, subscribeCatalogChanges })
  }, PstackDetailAction));
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
