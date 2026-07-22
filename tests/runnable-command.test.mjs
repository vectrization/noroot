import test from "node:test";
import assert from "node:assert/strict";

import {
  commandFromPromptLine,
  runnableCodeFor,
} from "../src/lib/sandbox/runnable-command.js";

test("extracts commands from user and root prompts", () => {
  assert.equal(commandFromPromptLine("user@machine:~$ pwd"), "pwd");
  assert.equal(commandFromPromptLine("root@archiso ~ # lsblk"), "lsblk");
});

test("uses the first command rather than shell output", () => {
  const session = "user@machine:~$ pwd\n/home/user\nuser@machine:~$ ls";
  assert.equal(runnableCodeFor(session, "shellsession"), "pwd");
});

test("keeps dollar syntax intact in plain shell code", () => {
  assert.equal(runnableCodeFor("echo $# args", "shell"), "echo $# args");
});

test("joins explicitly selected command lines", () => {
  const session = "user@machine:~$ pwd\n/home/user\nuser@machine:~$ ls -la";
  assert.equal(runnableCodeFor(session, "shellsession", [1, 3]), "pwd\nls -la");
});
