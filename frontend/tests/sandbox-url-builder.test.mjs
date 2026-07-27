import assert from "node:assert/strict";
import test from "node:test";

import {
  allSandboxUrlCombinations,
  buildSandboxUrl,
  encodeSandboxPayloads,
} from "../src/lib/sandbox/url-builder.js";
import { decodeBase64Url } from "../src/lib/sandbox/url-session.js";

const values = {
  c: "ls -la",
  p: [{ command: "pwd", output: "/home/student" }],
  q: { title: "Files", instructions: ["List files"] },
  s: { hostname: "files-lab", user: { name: "student" } },
};

test("encodes each sandbox payload independently", () => {
  const payloads = encodeSandboxPayloads(values);

  assert.equal(decodeBase64Url(payloads.c), values.c);
  assert.deepEqual(JSON.parse(decodeBase64Url(payloads.q)), values.q);
  assert.deepEqual(JSON.parse(decodeBase64Url(payloads.s)), values.s);
  assert.deepEqual(JSON.parse(decodeBase64Url(payloads.o)).q, values.q);
});

test("builds a URL containing only the requested parameters", () => {
  const url = new URL(buildSandboxUrl("https://example.com/notes", values, ["q", "s"]));

  assert.equal(url.pathname, "/sandbox");
  assert.deepEqual([...url.searchParams.keys()], ["q", "s"]);
  assert.equal(JSON.parse(decodeBase64Url(url.searchParams.get("s"))).hostname, "files-lab");
});

test("generates all fifteen non-empty parameter combinations plus compact o", () => {
  const combinations = allSandboxUrlCombinations("https://example.com", values);

  assert.equal(combinations.length, 16);
  assert.equal(new Set(combinations.map(({ url }) => url)).size, 16);
  assert.ok(combinations.some(({ id }) => id === "c"));
  assert.ok(combinations.some(({ id }) => id === "p+q+s"));
  assert.ok(combinations.some(({ id }) => id === "c+p+q+s"));
  assert.ok(combinations.some(({ id }) => id === "o"));
});
