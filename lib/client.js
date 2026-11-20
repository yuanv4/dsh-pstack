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
var import_react2 = require("react");

// src/client/PstackSettings.tsx
var import_react = require("react");

// src/roles.ts
var SCALAR_ROLES = [
  "feature",
  "refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment-and-prose",
  "hardest-tasks",
  "how-explorer",
  "how-explainer",
  "why-investigators",
  "why-synthesizer",
  "reflect-tooling",
  "reflect-judgment",
  "swarm-workers",
  "independent-verifier",
  "poteto-agent",
  "comment-sicko"
];
var PANEL_ROLES = [
  "how-critics",
  "arena-runners",
  "arena-cross-judge-pool",
  "architect-runners",
  "interrogate-reviewers"
];
var ALL_ROLES = [...SCALAR_ROLES, ...PANEL_ROLES];
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
  return drafts.map((draft) => draft.role === "how-critics" ? draft : {
    ...draft,
    inherit: true,
    inheritChoice: choice,
    routes: []
  });
}
function applyRouteToAll(drafts, route, live) {
  const cleaned = stripIllegalEffort(route, live);
  if (liveFor(live, cleaned.provider, cleaned.model) === void 0) return drafts;
  return drafts.map((draft) => draft.role === "how-critics" ? draft : {
    ...draft,
    inherit: false,
    inheritChoice: "inherit-parent",
    routes: draft.panel ? [{ ...cleaned }] : [{ ...cleaned }]
  });
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
var SETTINGS_SNAPSHOT_PATH = "/plugins/pstack-dsh/settings";
var SETTINGS_SAVE_PATH = "/plugins/pstack-dsh/settings";

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

// src/client/poteto-defaults.ts
var GROK = "grok-4.6-fast-xhigh";
var SOL = "gpt-5.6-sol-max";
var FABLE = "claude-fable-5-1-thinking-max";
var PANEL = `${FABLE}, ${SOL}, ${GROK}, claude-opus-5-thinking-xhigh`;
var POTETO_DEFAULT_SLUGS = {
  feature: GROK,
  refactoring: GROK,
  "bug-fix": FABLE,
  "perf-issue": FABLE,
  hillclimb: FABLE,
  "judgment-and-prose": FABLE,
  "hardest-tasks": FABLE,
  "how-explorer": GROK,
  "how-explainer": FABLE,
  "why-investigators": GROK,
  "why-synthesizer": FABLE,
  "reflect-tooling": SOL,
  "reflect-judgment": FABLE,
  "swarm-workers": GROK,
  "independent-verifier": "",
  "poteto-agent": "",
  "comment-sicko": "",
  "how-critics": "",
  "arena-runners": PANEL,
  "arena-cross-judge-pool": PANEL,
  "architect-runners": PANEL,
  "interrogate-reviewers": PANEL
};
function potetoNoteCopy(role, prefix) {
  const slugs = POTETO_DEFAULT_SLUGS[role];
  return slugs.length === 0 ? "" : `${prefix}${slugs}`;
}

// src/client/PstackSettings.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var GROUPS = [
  { id: "groupPlaybooks", roles: ["feature", "refactoring", "bug-fix", "perf-issue", "hillclimb", "judgment-and-prose", "hardest-tasks"] },
  { id: "groupSkills", roles: ["how-explorer", "how-explainer", "why-investigators", "why-synthesizer", "reflect-tooling", "reflect-judgment", "swarm-workers"] },
  { id: "groupVerify", roles: ["independent-verifier", "poteto-agent", "comment-sicko"] },
  { id: "groupPanels", roles: PANEL_ROLES.filter((role) => role !== "how-critics") }
];
var SETTINGS_CSS = `
.pstack-page .pstack-button {
  min-height:32px; padding:0 12px; border:1px solid transparent; border-radius:8px;
  background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer;
}
.pstack-page .pstack-button--primary { background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-inverted); }
.pstack-page .pstack-button--outline { border-color:var(--dsw-alias-border-l2); }
.pstack-page .pstack-button:not(:disabled):hover { background:var(--dsw-alias-bg-layer-3); }
.pstack-page .pstack-button--primary:not(:disabled):hover { background:var(--dsw-alias-button-primary-hover); }
.pstack-page .pstack-button:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.pstack-page .pstack-button:disabled { cursor:default; opacity:.5; }
.pstack-page { display:flex; flex-direction:column; gap:12px; max-width:720px; color:var(--dsw-alias-label-primary); }
.pstack-page .pstack-title { margin:0; font-size:16px; line-height:24px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-page .pstack-intro { margin:0; font-size:14px; line-height:22px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-note { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-warn { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-warn-label); }
.pstack-page .pstack-error { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-state-error-primary); }
.pstack-page .pstack-ok { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-success-primary); }
.pstack-page .pstack-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.pstack-page .pstack-group { margin:12px 0 0; display:flex; flex-direction:column; gap:8px; }
.pstack-page .pstack-group-title { margin:0; font-size:12px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-card {
  border:1px solid var(--dsw-alias-border-l2); border-radius:12px;
  padding:12px 14px; display:flex; flex-direction:column; gap:10px;
  background:var(--dsw-alias-bg-module-platform);
}
.pstack-page .pstack-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.pstack-page .pstack-role { margin:0; font-size:13px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.pstack-page .pstack-fields { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.pstack-page .pstack-field { display:flex; flex-direction:column; gap:4px; min-width:180px; flex:1; }
.pstack-page .pstack-label { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-select {
  height:34px; padding:0 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px; line-height:20px;
}
.pstack-page .pstack-select:focus-visible { outline:none; border-color:var(--dsw-alias-brand-primary); }
.pstack-page .pstack-select:disabled { color:var(--dsw-alias-label-tertiary); cursor:default; }
.pstack-page .pstack-row { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.pstack-page .pstack-path { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); word-break:break-all; }
`;
function overlaysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function RoleHead({ role, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-card-head", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-role", children: role }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-note", children: potetoNoteCopy(role, t("potetoPrefix")) })
  ] });
}
function firstRoute(routes) {
  const route = routes[0];
  if (route === void 0) return void 0;
  return { provider: route.provider, model: route.model };
}
function EffortSelect({
  id,
  route,
  live,
  t,
  onChange
}) {
  const found = liveFor(live, route.provider, route.model);
  if (found === void 0 || found.efforts.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "pstack-label", htmlFor: id, children: t("effort") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "select",
      {
        id,
        className: "pstack-select",
        value: route.reasoningEffort ?? "",
        onChange: (event) => {
          const idValue = event.target.value;
          onChange(idValue.length === 0 ? { provider: route.provider, model: route.model } : { provider: route.provider, model: route.model, reasoningEffort: idValue });
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("effortOmit") }),
          route.reasoningEffort !== void 0 && !found.efforts.some((effort) => effort.id === route.reasoningEffort) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: route.reasoningEffort, disabled: true, children: [
            route.reasoningEffort,
            " \xB7 ",
            t("unavailable")
          ] }) : null,
          found.efforts.map((effort) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: effort.id, children: effort.name || effort.id }, effort.id))
        ]
      }
    )
  ] });
}
function RouteSelect({
  id,
  value,
  live,
  t,
  disabled,
  onChange
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id, className: "pstack-select", value, disabled, onChange: (event) => {
    onChange(event.target.value);
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "inherit-parent", children: t("inheritParent") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("auto") }),
    value !== "inherit-parent" && value !== "auto" && !live.some((route) => routeKey(route.provider, route.model) === value) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value, disabled: true, children: [
      value.replace("::", "/"),
      " \xB7 ",
      t("unavailable")
    ] }) : null,
    live.map((route) => {
      const key = routeKey(route.provider, route.model);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: key, children: [
        route.provider,
        "/",
        route.model
      ] }, key);
    })
  ] });
}
function PstackSettings({ t, subscribeCatalogChanges }) {
  if (t === void 0) throw new Error("pstack settings requires its translation function");
  const [drafts, setDrafts] = (0, import_react.useState)(void 0);
  const [saved, setSaved] = (0, import_react.useState)(void 0);
  const [live, setLive] = (0, import_react.useState)([]);
  const [path, setPath] = (0, import_react.useState)("");
  const [dropped, setDropped] = (0, import_react.useState)([]);
  const [error, setError] = (0, import_react.useState)(void 0);
  const [catalogError, setCatalogError] = (0, import_react.useState)(void 0);
  const [notice, setNotice] = (0, import_react.useState)(void 0);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const initialized = (0, import_react.useRef)(false);
  const catalogRequest = (0, import_react.useRef)(void 0);
  const refresh = (0, import_react.useCallback)(async () => {
    catalogRequest.current?.abort();
    const request = new AbortController();
    catalogRequest.current = request;
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
    }
  }, [t]);
  (0, import_react.useEffect)(() => {
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
  }, [refresh, subscribeCatalogChanges]);
  const currentOverlay = (0, import_react.useMemo)(() => drafts === void 0 ? void 0 : draftToOverlay(drafts), [drafts]);
  const dirty = saved !== void 0 && currentOverlay !== void 0 && !overlaysEqual(saved, currentOverlay);
  const empty = live.length === 0;
  const patchRole = (role, update) => {
    setDrafts((current) => current?.map((draft) => draft.role === role ? update(draft) : draft));
    setNotice(void 0);
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "section",
    {
      className: "pstack-page",
      "aria-labelledby": "pstack-settings-title",
      onFocusCapture: (event) => {
        if (event.target instanceof HTMLSelectElement) void refresh();
      },
      onPointerDownCapture: (event) => {
        if (event.target instanceof HTMLSelectElement) void refresh();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: SETTINGS_CSS }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "pstack-settings-title", className: "pstack-title", children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-intro", children: t("intro") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-note", children: t("catalogUpdates") }),
        error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-error", role: "alert", children: error }) : null,
        catalogError !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-error", role: "alert", children: catalogError }) : null,
        notice !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-ok", role: "status", children: notice }) : null,
        dropped.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-warn", children: t("dropped") }) : null,
        drafts === void 0 ? catalogError === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-note", children: t("loading") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pstack-button pstack-button--outline", onClick: () => {
          void refresh();
        }, children: t("reload") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "pstack-warn", children: t("emptyCatalog") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-toolbar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pstack-button pstack-button--primary", disabled: busy || !dirty, onClick: () => {
              void save();
            }, children: busy ? t("saving") : t("save") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pstack-button pstack-button--outline", disabled: busy, onClick: () => {
              void refresh();
            }, children: t("reload") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "pstack-button pstack-button--ghost",
                disabled: busy,
                onClick: () => {
                  setDrafts((current) => current === void 0 ? current : applyInheritAll(current));
                  setNotice(void 0);
                },
                children: t("resetAll")
              }
            ),
            !empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "pstack-field", style: { minWidth: 220 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pstack-label", children: t("applyAll") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "select",
                {
                  className: "pstack-select",
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
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("applyAll") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "inherit-parent", children: t("applyAllInherit") }),
                    live.map((route) => {
                      const key = routeKey(route.provider, route.model);
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: key, children: [
                        route.provider,
                        "/",
                        route.model
                      ] }, key);
                    })
                  ]
                }
              )
            ] }) : null
          ] }),
          GROUPS.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "pstack-group-title", children: t(group.id) }),
            group.roles.map((role) => {
              const draft = drafts.find((entry) => entry.role === role);
              if (draft === void 0) return null;
              if (!draft.panel) {
                const route = draft.routes[0];
                return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "pstack-card", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleHead, { role, t }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-fields", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-field", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "pstack-label", htmlFor: `pstack-role-${role}`, children: role }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        RouteSelect,
                        {
                          id: `pstack-role-${role}`,
                          value: routeSelectValue(draft),
                          live,
                          t,
                          disabled: busy,
                          onChange: (value) => {
                            setScalarChoice(role, value);
                          }
                        }
                      )
                    ] }),
                    route !== void 0 && !draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      EffortSelect,
                      {
                        id: `pstack-effort-${role}`,
                        route,
                        live,
                        t,
                        onChange: (next) => {
                          patchRole(role, (current) => ({ ...current, routes: [next] }));
                        }
                      }
                    ) : null
                  ] })
                ] }, role);
              }
              const rows = draft.inherit ? [] : draft.routes;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "pstack-card", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleHead, { role, t }),
                draft.inherit ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "pstack-label", htmlFor: `pstack-role-${role}`, children: t("inheritParent") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    RouteSelect,
                    {
                      id: `pstack-role-${role}`,
                      value: draft.inheritChoice,
                      live: [],
                      t,
                      disabled: busy,
                      onChange: (value) => {
                        if (value === "inherit-parent" || value === "auto") {
                          patchRole(role, (current) => ({
                            ...current,
                            inherit: true,
                            inheritChoice: value,
                            routes: []
                          }));
                        }
                      }
                    }
                  )
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "pstack-button pstack-button--ghost",
                    disabled: busy,
                    onClick: () => {
                      patchRole(role, (current) => ({
                        ...current,
                        inherit: true,
                        inheritChoice: "inherit-parent",
                        routes: []
                      }));
                    },
                    children: t("inheritParent")
                  }
                ),
                !draft.inherit ? rows.map((route, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-row", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pstack-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "pstack-label", htmlFor: `pstack-panel-${role}-${index}`, children: `${role}[${index}]` }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      RouteSelect,
                      {
                        id: `pstack-panel-${role}-${index}`,
                        value: routeSelectValue({ ...draft, inherit: false, routes: [route] }),
                        live,
                        t,
                        disabled: busy || empty,
                        onChange: (value) => {
                          setPanelChoice(role, index, value);
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    EffortSelect,
                    {
                      id: `pstack-panel-effort-${role}-${index}`,
                      route,
                      live,
                      t,
                      onChange: (next) => {
                        patchRole(role, (current) => {
                          const nextRoutes = [...current.routes];
                          nextRoutes[index] = next;
                          return { ...current, inherit: false, routes: nextRoutes };
                        });
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "pstack-button pstack-button--ghost",
                      disabled: busy,
                      onClick: () => {
                        patchRole(role, (current) => {
                          const nextRoutes = current.routes.filter((_, item) => item !== index);
                          return nextRoutes.length === 0 ? { ...current, inherit: true, routes: [] } : { ...current, inherit: false, routes: nextRoutes };
                        });
                      },
                      children: t("removeRoute")
                    }
                  )
                ] }, `${role}-${index}`)) : null,
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "pstack-button pstack-button--outline",
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
              ] }, role);
            })
          ] }, group.id)),
          path.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "pstack-path", children: [
            t("overlayPath"),
            ": ",
            path
          ] }) : null
        ] })
      ]
    }
  );
}

// src/client/locales.ts
var en = {
  nav: "pstack roles",
  title: "pstack roles",
  intro: "Assign a model listed by DSH to each pstack role. Roles without a mapping inherit this conversation. Settings are saved to $DSH_HOME/pstack-dsh.json.",
  loading: "Loading models\u2026",
  close: "Close",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved. New pstack_spawn calls pick this up.",
  reload: "Refresh models",
  catalogUpdates: "Model choices update automatically after login or model changes. Unsaved role settings are preserved.",
  unavailable: "currently unavailable",
  resetAll: "Inherit for every role",
  inheritParent: "inherit-parent",
  auto: "auto",
  potetoPrefix: "Poteto 0.15 recommendation: ",
  emptyCatalog: "DSH lists no available models. Roles inherit this conversation. Check Settings \u2192 Models.",
  effort: "Effort",
  effortOmit: "omit (adapter default)",
  addRoute: "Add route",
  removeRoute: "Remove",
  applyAll: "Apply to every role",
  applyAllInherit: "Inherit parent for every role",
  overlayPath: "Overlay",
  dropped: "Some saved mappings pointed at models that DSH no longer lists. Those roles now inherit until you save again.",
  requestFailed: "The settings request failed.",
  groupPlaybooks: "Playbook delegates",
  groupSkills: "Skill roles",
  groupVerify: "Verify and helpers",
  groupPanels: "Panel roles"
};
var zh = {
  nav: "pstack \u89D2\u8272",
  title: "pstack \u89D2\u8272",
  intro: "\u4E3A\u6BCF\u4E2A pstack \u89D2\u8272\u9009\u62E9 DSH \u5217\u51FA\u7684\u6A21\u578B\u3002\u672A\u914D\u7F6E\u7684\u89D2\u8272\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002\u8BBE\u7F6E\u4FDD\u5B58\u5728 $DSH_HOME/pstack-dsh.json\u3002",
  loading: "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u2026",
  close: "\u5173\u95ED",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u3002\u4E4B\u540E\u7684 pstack_spawn \u4F1A\u8BFB\u5230\u8FD9\u4EFD overlay\u3002",
  reload: "\u5237\u65B0\u6A21\u578B\u5217\u8868",
  catalogUpdates: "\u767B\u5F55\u6216\u6A21\u578B\u53D8\u66F4\u540E\u81EA\u52A8\u66F4\u65B0\u5217\u8868\uFF0C\u4E0D\u4F1A\u8986\u76D6\u672A\u4FDD\u5B58\u7684\u89D2\u8272\u8BBE\u7F6E\u3002",
  unavailable: "\u6682\u4E0D\u53EF\u7528",
  resetAll: "\u5168\u90E8\u7EE7\u627F\u7236\u5BF9\u8BDD",
  inheritParent: "inherit-parent",
  auto: "auto",
  potetoPrefix: "Poteto 0.15 \u63A8\u8350\uFF1A",
  emptyCatalog: "DSH \u6CA1\u6709\u5217\u51FA\u53EF\u7528\u6A21\u578B\uFF0C\u89D2\u8272\u5C06\u7EE7\u627F\u5F53\u524D\u5BF9\u8BDD\u3002\u8BF7\u68C0\u67E5\u8BBE\u7F6E \u2192 \u6A21\u578B\u3002",
  effort: "Effort",
  effortOmit: "\u7701\u7565\uFF08\u9002\u914D\u5668\u9ED8\u8BA4\uFF09",
  addRoute: "\u6DFB\u52A0\u8DEF\u7531",
  removeRoute: "\u79FB\u9664",
  applyAll: "\u5E94\u7528\u5230\u5168\u90E8\u89D2\u8272",
  applyAllInherit: "\u5168\u90E8\u89D2\u8272\u7EE7\u627F\u7236\u5BF9\u8BDD",
  overlayPath: "Overlay",
  dropped: "\u6709\u4E9B\u5DF2\u4FDD\u5B58\u7684\u6620\u5C04\u6307\u5411\u4E86DSH \u4E0D\u518D\u5217\u51FA\u7684\u6A21\u578B\u3002\u8FD9\u4E9B\u89D2\u8272\u5DF2\u6539\u56DE\u7EE7\u627F\uFF0C\u4FDD\u5B58\u540E\u624D\u4F1A\u5199\u76D8\u3002",
  requestFailed: "\u8BBE\u7F6E\u8BF7\u6C42\u5931\u8D25\u3002",
  groupPlaybooks: "\u73A9\u6CD5\u59D4\u6D3E",
  groupSkills: "\u6280\u80FD\u89D2\u8272",
  groupVerify: "\u6838\u9A8C\u4E0E\u52A9\u624B",
  groupPanels: "\u9762\u677F\u89D2\u8272"
};

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var name = "pstack-dsh-client";
var inject = ["slots", "locale", "remote"];
function PstackDetailAction({ subject, t, subscribeCatalogChanges }) {
  const dialog = (0, import_react2.useRef)(null);
  const [opened, setOpened] = (0, import_react2.useState)(false);
  if (subject.kind !== "bundle" || subject.pkg.name !== PLUGIN_ID) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: `
      .pstack-detail-dialog { width:min(760px, calc(100vw - 32px)); max-height:calc(100dvh - 32px); box-sizing:border-box; padding:20px; border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); }
      .pstack-detail-dialog::backdrop { background:rgb(0 0 0 / 45%); }
      .pstack-detail-action { min-height:32px; padding:0 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; }
      .pstack-detail-action:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); }
      .pstack-detail-close { display:flex; justify-content:flex-end; margin-bottom:8px; }
    ` }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pstack-detail-action", onClick: () => {
      dialog.current?.showModal();
      setOpened(true);
    }, children: t("nav") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dialog", { ref: dialog, className: "pstack-detail-dialog", "aria-label": t("title"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("form", { method: "dialog", className: "pstack-detail-close", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "pstack-detail-action", "aria-label": t("close"), children: "\xD7" }) }),
      opened && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PstackSettings, { t, subscribeCatalogChanges })
    ] })
  ] });
}
function apply(ctx) {
  const namespace = "settings.pstack";
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), "pstack-dsh: settings copy");
  const t = ctx.locale.bind(namespace);
  const subscribeCatalogChanges = (listener) => listenForCatalogChanges(ctx, listener);
  ctx.slots.inject("plugins.detail.actions", () => ctx.slots.register({
    name: "plugins.detail.actions",
    id: "pstack-role-settings",
    inject: () => ({ t, subscribeCatalogChanges })
  }, PstackDetailAction));
}

		return module.exports;
	}
});
