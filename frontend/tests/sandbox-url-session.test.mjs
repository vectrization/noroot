import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeBase64Url,
  encodeBase64Url,
  readSandboxSession,
} from "../src/lib/sandbox/url-session.js";

test("round-trips unicode base64url text", () => {
  const value = "printf 'hello' && echo 你好";
  assert.equal(decodeBase64Url(encodeBase64Url(value)), value);
});

test("reads one command from c", () => {
  const session = readSandboxSession("?c=bHM");
  assert.equal(session.current, "ls");
  assert.deepEqual(session.commands, []);
});

test("reads strings, records, and key-value history entries from p", () => {
  const history = encodeBase64Url(JSON.stringify([
    "pwd",
    { command: "ls -la", output: "ignored" },
    ["touch example.txt", ""],
    { output: "ignored without a command" },
  ]));

  const session = readSandboxSession(`?p=${history}`);
  assert.deepEqual(session.commands, [
    "pwd",
  ]);
  assert.deepEqual(session.displayHistory.map((item) => item.command), [
    "pwd",
    "ls -la",
    "touch example.txt",
  ]);
  assert.equal(session.displayHistory[1].output, "ignored");
});

test("keeps c as current input and runs only previous commands", () => {
  const previous = encodeBase64Url(JSON.stringify(["pwd"]));
  const command = encodeBase64Url("cd /tmp\nls");
  const session = readSandboxSession(`?p=${previous}&c=${command}`);
  assert.deepEqual(session.commands, ["pwd"]);
  assert.equal(session.current, "cd /tmp\nls");
});

test("supports plain and structured quests", () => {
  const plain = readSandboxSession(`?q=${encodeBase64Url("Find the home directory.")}`).quest;
  assert.deepEqual(plain, {
    chapter: "",
    lesson: "Objective",
    title: "Objective",
    description: "Find the home directory.",
    scoringEnabled: false,
    tasks: [],
    instructions: [],
  });

  const structured = readSandboxSession(`?q=${encodeBase64Url(JSON.stringify({
    chapter: "Terminal Basics",
    lesson: "Permissions",
    description: "Lock down a file.",
    scoringEnabled: true,
    tasks: [
      {
        required: true,
        label: "Print the working directory",
        hint: "Use pwd.",
        solution: "pwd",
        solutionText: "pwd prints the current directory.",
        requiresInput: true,
        score: 1,
      },
      {
        required: true,
        label: "Set mode 600",
        solutions: ["chmod 600 secret.txt", "chmod u=rw,go= secret.txt"],
        requiresInput: false,
        score: 5,
      },
    ],
  }))}`).quest;
  assert.deepEqual(structured, {
    chapter: "Terminal Basics",
    lesson: "Permissions",
    title: "Terminal Basics / Permissions",
    description: "Lock down a file.",
    scoringEnabled: true,
    tasks: [
      {
        id: "task-1",
        required: true,
        label: "Print the working directory",
        hint: "Use pwd.",
        solutions: ["pwd"],
        solutionText: "pwd prints the current directory.",
        solutionImage: null,
        requiresInput: true,
        score: 1,
      },
      {
        id: "task-2",
        required: true,
        label: "Set mode 600",
        hint: "",
        solutions: ["chmod 600 secret.txt", "chmod u=rw,go= secret.txt"],
        solutionText: "",
        solutionImage: null,
        requiresInput: false,
        score: 5,
      },
    ],
    instructions: ["Print the working directory", "Set mode 600"],
  });
});

test("normalizes scene identity, files, environment, and layout", () => {
  const scenePayload = encodeBase64Url(JSON.stringify({
    hostname: "files-lab",
    user: { name: "student", uid: 1200, password: "learn" },
    cwd: "/work",
    env: { LESSON: "permissions", "bad-key": "ignored" },
    files: {
      "/work": { type: "directory", mode: "750" },
      "/work/readme.txt": { content: "hello\n", mode: "640" },
    },
    accent: "amber",
    questLayout: "horizontal",
  }));
  const scene = readSandboxSession(`?s=${scenePayload}`).scene;

  assert.deepEqual(scene.user, {
    name: "student",
    uid: 1200,
    home: "/home/student",
    password: "learn",
  });
  assert.equal(scene.hostname, "files-lab");
  assert.equal(scene.cwd, "/work");
  assert.deepEqual(scene.env, { LESSON: "permissions" });
  assert.equal(scene.files[0].type, "directory");
  assert.equal(scene.files[1].path, "/work/readme.txt");
  assert.equal(scene.accent, "amber");
  assert.equal(scene.questLayout, "horizontal");
});

test("reads compact o payload as c, p, q, and s fallback", () => {
  const payload = encodeBase64Url(JSON.stringify({
    c: "cat mission.txt",
    p: [{ command: "whoami", output: "student" }],
    q: { lesson: "Files", tasks: [{ label: "Read the mission", solution: "cat mission.txt" }] },
    s: { hostname: "compact-lab", cwd: "/workspace" },
  }));
  const session = readSandboxSession(`?o=${payload}`);

  assert.equal(session.current, "cat mission.txt");
  assert.equal(session.displayHistory[0].output, "student");
  assert.equal(session.quest.lesson, "Files");
  assert.equal(session.scene.hostname, "compact-lab");
});

test("falls back field-by-field for malformed scene data", () => {
  const payload = encodeBase64Url(JSON.stringify({
    hostname: "not a host!",
    user: { name: "Root User", uid: -4 },
    cwd: "relative",
    files: { relative: "ignored" },
    accent: "purple",
    questLayout: "diagonal",
  }));
  const scene = readSandboxSession(`?s=${payload}`).scene;

  assert.equal(scene.hostname, "no-root");
  assert.equal(scene.user.name, "user");
  assert.equal(scene.cwd, "/home/user");
  assert.deepEqual(scene.files, []);
  assert.equal(scene.accent, "cyan");
  assert.equal(scene.questLayout, "vertical");
});

test("ignores malformed payloads", () => {
  const session = readSandboxSession("?p=not-json&c=%25%25%25&q=%25%25%25&s=%25%25%25");
  assert.deepEqual(session.commands, []);
  assert.equal(session.quest, null);
  assert.equal(session.scene.hostname, "no-root");
});
