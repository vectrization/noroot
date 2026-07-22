import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRootSetup,
  buildShellSetup,
  shellQuote,
} from "../src/lib/sandbox/guest-setup.js";

const scene = {
  hostname: "lab-box",
  user: {
    name: "student",
    uid: 1001,
    home: "/home/student",
    password: "let's-go",
  },
  cwd: "/workspace",
  env: { COURSE: "shell basics" },
  files: [
    {
      path: "/workspace/notes.txt",
      type: "file",
      content: "one\ntwo",
      mode: "640",
      owner: "student",
      group: "student",
    },
  ],
  accent: "amber",
};

test("quotes arbitrary values for POSIX sh", () => {
  assert.equal(shellQuote("let's-go"), `'let'"'"'s-go'`);
});

test("builds hidden root setup for identity, files, and password-gated sudo", () => {
  const setup = buildRootSetup(scene);

  assert.match(setup, /hostname 'lab-box'/);
  assert.match(setup, /adduser -D -u 1001/);
  assert.match(setup, /\/workspace\/notes\.txt/);
  assert.match(setup, /\[sudo\] password for %s:/);
  assert.match(setup, /Sorry, try again\./);
  assert.match(setup, /exec su 'student' -s \/bin\/sh/);
  assert.doesNotMatch(setup, /Message from No Root Access/);
});

test("builds a colored dynamic prompt and applies scene environment", () => {
  const setup = buildShellSetup(scene, 92, 31, "__READY__");

  assert.match(setup, /export COURSE='shell basics'/);
  assert.match(setup, /cd '\/workspace'/);
  assert.match(setup, /38;5;220/);
  assert.match(setup, /\\u/);
  assert.match(setup, /\\h/);
  assert.match(setup, /\\w/);
  assert.match(setup, /stty cols 92 rows 31/);
  assert.match(setup, /__READY__/);
});
