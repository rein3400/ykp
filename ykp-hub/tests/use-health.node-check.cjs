/* use-health hook checks — .node-check.cjs so Vitest won't discover.
 * Transpiles the ACTUAL candidate hook with the verified TypeScript
 * transpiler and executes it in Node vm with a deterministic fake React
 * hook boundary, mocked fetch/timers.
 * Covers: immutable history (copy, no mutate, 12-cap, no skipped samples),
 * background interval without loading rerender, unmount-safe r.json.
 * Run: node tests/use-health.node-check.cjs
 * Override hook under test: HOOK_PATH=/abs/path/to/use-health.ts
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const TS_PATH = require.resolve("typescript", {paths: [process.cwd(), "D:/Users/stefa/Project/ai-literacy-platform"]});
const DEFAULT_HOOK = path.join(__dirname, "..", "app", "hooks", "use-health.ts");
const HOOK_PATH = process.env.HOOK_PATH || DEFAULT_HOOK;

function loadHook() {
  const ts = require(TS_PATH);
  const src = fs.readFileSync(HOOK_PATH, "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  return out.outputText;
}

/* Deterministic fake React boundary + mocked fetch/timers per test. */
function setup(js) {
  const state = { health: null, history: {}, loading: false };
  const stats = { setLoadingCalls: [], setHealthCalls: 0, setHistoryUpdaters: [] };
  const mountedRef = { current: true };
  let refreshFn = null;
  let effectFn = null;
  let effectDeps = null;
  const timers = { intervals: [], cleared: [] };
  const fetchQueue = []; // array of () => response for each fetch call
  const fetchCalls = [];

  const fakeReact = {
    useState(initial) {
      const idx = fakeReact.__idx++;
      const key = ["health", "history", "loading"][idx];
      return [
        state[key] !== undefined ? state[key] : initial,
        (v) => {
          if (key === "loading") stats.setLoadingCalls.push(v);
          if (key === "health") stats.setHealthCalls++;
          if (key === "history") stats.setHistoryUpdaters.push(v);
          state[key] = typeof v === "function" ? v(state[key]) : v;
        },
      ];
    },
    __idx: 0,
    useRef(init) {
      return mountedRef;
    },
    useCallback(fn) {
      refreshFn = fn;
      return fn;
    },
    useEffect(fn, deps) {
      effectFn = fn;
      effectDeps = deps;
    },
  };

  const sandbox = {
    require: (name) => {
      if (name === "react") return fakeReact;
      return require(name);
    },
    console,
    Promise,
    Object,
    Array,
    JSON,
    Error,
    fetch: (...args) => {
      fetchCalls.push(args);
      const next = fetchQueue.shift();
      if (!next) return Promise.reject(new Error("unexpected fetch (queue empty)"));
      return next();
    },
    setInterval: (fn, ms) => {
      const id = timers.intervals.length + 1;
      timers.intervals.push({ id, fn, ms });
      return id;
    },
    clearInterval: (id) => {
      timers.cleared.push(id);
    },
  };
  sandbox.module = { exports: {} };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox, { filename: "use-health.transpiled.js" });
  const useHealth = sandbox.module.exports.useHealth || sandbox.exports.useHealth;
  assert.strictEqual(typeof useHealth, "function", "useHealth must be exported");

  function render(seedHistory) {
    fakeReact.__idx = 0;
    if (seedHistory !== undefined) state.history = seedHistory;
    const ret = useHealth(30000);
    refreshFn = ret.refresh;
    return ret;
  }

  const flush = (n = 10) => {
    let p = Promise.resolve();
    for (let i = 0; i < n; i++) p = p.then(() => {});
    return p;
  };

  function okFetch(data) {
    return () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  }

  return { state, stats, mountedRef, timers, fetchQueue, fetchCalls, render, flush, okFetch,
    getRefresh: () => refreshFn, getEffect: () => effectFn };
}

function mkHealth(pingById) {
  return {
    data: {
      overall: "ok",
      ts: "2026-09-06T00:00:00.000Z",
      results: Object.entries(pingById).map(([id, pingMs]) => ({
        id, name: id, url: "http://x", pingMs, httpStatus: 200, reachable: true, recordCount: 1,
      })),
    },
  };
}

const results = [];
// vm-realm arrays carry the vm context's Array prototype, so normalize
// through JSON before structural comparison.
const plain = (v) => JSON.parse(JSON.stringify(v));
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { results.push("PASS " + name); })
    .catch((e) => { results.push("FAIL " + name + " :: " + (e && e.message)); });
}

(async () => {
  const js = loadHook();

  // 1. immutable history: no mutation of previous arrays, new refs, values appended
  await test("history-immutable-no-mutate", async () => {
    const h = setup(js);
    const prevArr = [1, 2, 3];
    h.render({ mod1: prevArr });
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 99 })));
    await h.getRefresh()();
    await h.flush();
    assert.deepStrictEqual(plain(prevArr), [1, 2, 3], "previous array must not be mutated");
    assert.strictEqual(h.stats.setHistoryUpdaters.length, 1, "setHistory called once");
    const next = h.state.history.mod1;
    assert.ok(next !== prevArr, "history array must be a new reference");
    assert.deepStrictEqual(plain(next), [1, 2, 3, 99]);
  });

  // 2. 12-sample cap retained
  await test("history-keeps-12-cap", async () => {
    const h = setup(js);
    const seed = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
    h.render({ mod1: seed });
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 99 })));
    await h.getRefresh()();
    await h.flush();
    assert.strictEqual(plain(h.state.history.mod1).length, 12, "history capped at 12");
    assert.deepStrictEqual(plain(h.state.history.mod1), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99]);
    assert.deepStrictEqual(plain(seed), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "seed not mutated");
  });

  // 3. changed ping values are not skipped (no false zero-rerender bail-out)
  await test("history-keeps-changed-pings", async () => {
    const h = setup(js);
    h.render({ mod1: [10] });
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 20 })));
    await h.getRefresh()();
    await h.flush();
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 30 })));
    await h.getRefresh()();
    await h.flush();
    assert.deepStrictEqual(plain(h.state.history.mod1), [10, 20, 30]);
  });

  // 4. manual/initial refresh toggles loading true->false
  await test("foreground-refresh-toggles-loading", async () => {
    const h = setup(js);
    h.render({});
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 5 })));
    await h.getRefresh()();
    await h.flush();
    assert.deepStrictEqual(h.stats.setLoadingCalls, [true, false]);
  });

  // 5. background refresh never touches loading but still updates health
  await test("background-refresh-no-loading", async () => {
    const h = setup(js);
    h.render({});
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 7 })));
    await h.getRefresh()({ background: true });
    await h.flush();
    assert.deepStrictEqual(h.stats.setLoadingCalls, [], "background must not toggle loading");
    assert.strictEqual(h.stats.setHealthCalls, 1, "background must still update health");
    assert.deepStrictEqual(plain(h.state.history.mod1), [7]);
  });

  // 6. interval callback runs in background mode (no loading), initial is foreground
  await test("interval-uses-background-mode", async () => {
    const h = setup(js);
    h.render({});
    const effect = h.getEffect();
    assert.ok(effect, "effect must be registered");
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 1 }))); // initial refresh
    const cleanup = effect();
    await h.flush(20);
    assert.deepStrictEqual(h.stats.setLoadingCalls, [true, false], "initial refresh is foreground");
    assert.strictEqual(h.timers.intervals.length, 1, "one interval registered");
    h.stats.setLoadingCalls.length = 0;
    h.fetchQueue.push(h.okFetch(mkHealth({ mod1: 2 }))); // interval tick
    await h.timers.intervals[0].fn();
    await h.flush(20);
    assert.deepStrictEqual(h.stats.setLoadingCalls, [], "interval tick must not toggle loading");
    assert.deepStrictEqual(plain(h.state.history.mod1), [1, 2]);
    assert.strictEqual(typeof cleanup, "function", "effect returns cleanup");
  });

  // 7. unmount-safe: unmount while r.json() pending -> no state updates, no loading(false)
  await test("unmount-during-json-no-update", async () => {
    const h = setup(js);
    h.render({});
    let resolveJson;
    const jsonGate = new Promise((res) => { resolveJson = res; });
    h.fetchQueue.push(() =>
      Promise.resolve({ ok: true, json: () => jsonGate })
    );
    const p = h.getRefresh()();
    await h.flush(5); // let hook reach await r.json()
    h.mountedRef.current = false; // simulate unmount cleanup
    resolveJson(mkHealth({ mod1: 42 }));
    await p;
    await h.flush(10);
    assert.strictEqual(h.stats.setHealthCalls, 0, "no setHealth after unmount");
    assert.strictEqual(h.stats.setHistoryUpdaters.length, 0, "no setHistory after unmount");
    assert.deepStrictEqual(
      h.stats.setLoadingCalls, [true],
      "no setLoading(false) after unmount (only initial true)"
    );
  });

  console.log("HOOK_PATH=" + HOOK_PATH);
  for (const r of results) console.log(r);
  const fails = results.filter((r) => r.startsWith("FAIL"));
  console.log(fails.length === 0 ? "ALL_PASS" : "FAILURES=" + fails.length);
  process.exit(fails.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS_ERROR", e);
  process.exit(2);
});
