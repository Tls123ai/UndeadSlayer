import { test } from "node:test";
import assert from "node:assert/strict";
import { finishLoading, LOADING_SCREEN_DURATIONS } from "../src/lib/clientApi";

test("fast startup loads keep the screen visible for two seconds", async (t) => {
  t.mock.method(performance, "now", () => 0);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finished = false;
  const pending = finishLoading(0).then(() => { finished = true; });
  t.mock.timers.tick(1_999);
  await Promise.resolve();
  assert.equal(finished, false);
  t.mock.timers.tick(1);
  await pending;
  assert.equal(finished, true);
  assert.equal(LOADING_SCREEN_DURATIONS.startup, 2_000);
});

test("authentication and cached battle loads remain legible for one second", async (t) => {
  t.mock.method(performance, "now", () => 0);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const duration of [LOADING_SCREEN_DURATIONS.authentication, LOADING_SCREEN_DURATIONS.battle]) {
    let finished = false;
    const pending = finishLoading(0, duration).then(() => { finished = true; });
    t.mock.timers.tick(999);
    await Promise.resolve();
    assert.equal(finished, false);
    t.mock.timers.tick(1);
    await pending;
    assert.equal(finished, true);
  }
});

test("slow loading does not add another full screen duration", async (t) => {
  t.mock.method(performance, "now", () => 5_000);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finished = false;
  const pending = finishLoading(0).then(() => { finished = true; });
  t.mock.timers.tick(139);
  await Promise.resolve();
  assert.equal(finished, false);
  t.mock.timers.tick(1);
  await pending;
  assert.equal(finished, true);
});

test("cancelling battle entry cancels the completion wait immediately", async (t) => {
  t.mock.method(performance, "now", () => 0);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  const pending = finishLoading(0, LOADING_SCREEN_DURATIONS.battle, controller.signal);
  const rejected = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  await rejected;
  t.mock.timers.tick(10_000);
  await assert.rejects(finishLoading(0, LOADING_SCREEN_DURATIONS.battle, controller.signal), { name: "AbortError" });
});
