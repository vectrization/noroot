import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildRootSetup,
  buildShellSetup,
} from "../lib/sandbox/guest-setup.js";
import {
  DISTRO_PROFILES,
  encodeBase64Url,
  readSandboxSession,
} from "../lib/sandbox/url-session.js";

const BUILDROOT_IMAGE_SIZE = 5166352;
const READY_MARKER = "__NO_ROOT_ACCESS_READY__";
const PROMPT_PATTERN = /[#$%] $/;

const TERMINAL_ACCENTS = {
  cyan: { cursor: "#67e8f9", selection: "#164e63" },
  green: { cursor: "#86efac", selection: "#14532d" },
  amber: { cursor: "#facc15", selection: "#713f12" },
  magenta: { cursor: "#f0abfc", selection: "#701a75" },
};

const STATUS_TONES = {
  ready: "bg-emerald-400",
  running: "bg-cyan-300",
  loading: "bg-amber-300",
  booting: "bg-amber-300",
  preparing: "bg-fuchsia-300",
  offline: "bg-rose-400",
};

const DISTRO_LABELS = {
  buildroot: "Buildroot",
  "debian-light": "Debian light",
  "kali-terminal": "Kali terminal",
  custom: "Custom image",
};

const AVAILABLE_PROFILES = new Set(["buildroot"]);

function taskListForQuest(quest) {
  if (!quest) return [];
  return quest.tasks.length
    ? quest.tasks
    : quest.instructions.map((label, index) => ({
      id: `instruction-${index + 1}`,
      required: true,
      label,
      hint: "",
      solutions: [],
      solutionText: "",
      solutionImage: null,
      requiresInput: false,
      score: 1,
    }));
}

function hasPromptAtEnd(value) {
  const finalLine = value.replace(/\r/g, "").split("\n").at(-1) || "";
  return PROMPT_PATTERN.test(finalLine);
}

function finalPrompt(value, fallback) {
  const finalLine = value.replace(/\r/g, "").split("\n").at(-1) || "";
  return hasPromptAtEnd(value) ? finalLine : fallback;
}

function Status({ state, detail }) {
  return (
    <span
      className="flex min-w-0 items-center justify-center gap-2 font-mono text-[10px] uppercase text-zinc-400"
      aria-live="polite"
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${STATUS_TONES[state] || "bg-zinc-500"}`}
        aria-hidden="true"
      />
      <span className="truncate">{state}</span>
      {detail && <span className="hidden truncate text-zinc-600 sm:inline">/ {detail}</span>}
    </span>
  );
}

function normalizeAnswer(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function canonicalCommand(value) {
  const normalized = normalizeAnswer(value);
  const lsMatch = normalized.match(/^ls\s+(-[a-z]+)(?:\s+(.*))?$/i);
  if (!lsMatch) return normalized;

  const flags = [...lsMatch[1].slice(1).toLowerCase().replace(/a/g, "a")]
    .map((flag) => flag === "a" ? "a" : flag)
    .sort()
    .join("");
  const target = lsMatch[2] ? ` ${lsMatch[2]}` : "";
  return `ls -${flags}${target}`;
}

function taskMatchesCommand(task, command) {
  if (task.requiresInput) return false;
  const normalizedCommand = canonicalCommand(command);
  return task.solutions.some((solution) => canonicalCommand(solution) === normalizedCommand);
}

function taskMatchesInput(task, value) {
  if (!task.requiresInput) return false;
  const normalizedValue = normalizeAnswer(value);
  return Boolean(normalizedValue)
    && task.solutions.some((solution) => normalizeAnswer(solution) === normalizedValue);
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatCompletedAt(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function QuestPanel({
  quest,
  completed,
  answers,
  onAnswer,
  layout,
  commandCount,
  submitted,
  elapsedSeconds,
  submittedAt,
  onSubmit,
  labReady,
}) {
  const tasks = taskListForQuest(quest);
  const completeCount = tasks.filter((task) => completed.has(task.id)).length;
  const total = tasks.length;
  const earned = tasks.reduce((sum, task) => sum + (completed.has(task.id) ? task.score : 0), 0);
  const possible = tasks.reduce((sum, task) => sum + task.score, 0);
  const percentage = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const border = layout === "horizontal"
    ? "border-t border-zinc-700"
    : "border-t border-zinc-700 md:border-l md:border-t-0";

  return (
    <aside
      className={`min-h-0 min-w-0 overflow-y-auto bg-zinc-900 text-zinc-100 ${border}`}
      aria-labelledby="quest-title"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-6 flex items-start justify-between gap-5 border-b border-zinc-700 pb-5">
          <div className="min-w-0">
            {(quest.chapter || quest.lesson) && (
              <p className="mb-2 truncate text-xs font-semibold text-blue-400">
                {quest.chapter || "Lab"}
              </p>
            )}
            <h1 id="quest-title" className="text-lg font-semibold leading-tight text-zinc-50 sm:text-xl">
              {quest.lesson || quest.title}
            </h1>
          </div>
          {total > 0 && (
            <div className="shrink-0 text-right font-mono">
              <span className="block text-xs font-semibold text-emerald-300">
                {submitted ? `${percentage}%` : formatElapsed(elapsedSeconds)}
              </span>
              <span className="mt-1 block text-[10px] uppercase text-zinc-500">
                {submitted ? `${completeCount}/${total} tasks` : labReady ? "in progress" : "preparing"}
              </span>
            </div>
          )}
        </div>

        {quest.description && (
          <p className="mb-5 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {quest.description}
          </p>
        )}

        {submitted && (
          <dl className="mb-5 grid grid-cols-3 gap-3 border-y border-zinc-700 py-3 font-mono text-[10px] uppercase">
            <div>
              <dt className="text-zinc-500">Result</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-300">{percentage}%</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Completed</dt>
              <dd className="mt-1 truncate text-xs text-zinc-300" title={formatCompletedAt(submittedAt)}>
                {formatCompletedAt(submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Time</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-300">{formatElapsed(elapsedSeconds)}</dd>
            </div>
          </dl>
        )}

        {total > 0 && (
          <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
            {tasks.map((task, index) => {
              const isComplete = completed.has(task.id);
              return (
                <li
                  key={task.id}
                  className={`px-1 py-4 ${isComplete ? "bg-emerald-950/10" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] ${isComplete ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}
                      aria-hidden="true"
                    >
                      {isComplete ? (
                        <span className="material-icons text-[14px]">check</span>
                      ) : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm leading-5 ${isComplete ? "text-emerald-100" : "text-zinc-100"}`}>
                          {task.label}
                        </p>
                        {submitted && (
                          <span className={`shrink-0 font-mono text-[10px] uppercase ${isComplete ? "text-emerald-300" : "text-rose-300"}`}>
                            {isComplete ? "passed" : "missed"}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-zinc-500">
                        <span>{task.requiresInput ? "Answer" : "Command"}</span>
                        {task.required && <span className="text-amber-300">required</span>}
                        <span>{submitted ? isComplete ? "complete" : "review" : commandCount ? "tracked" : "waiting"}</span>
                      </div>

                      {task.hint && (
                        <details className="mt-3 border-t border-zinc-800 pt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-400 outline-none hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-400">
                            Hint
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{task.hint}</p>
                        </details>
                      )}

                      {task.requiresInput && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            className="min-h-9 min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                            value={answers[task.id] || ""}
                            onChange={(event) => onAnswer(task, event.target.value)}
                            placeholder="answer"
                            disabled={submitted}
                            aria-label={`Answer for ${task.label}`}
                          />
                          <span className={`grid size-9 shrink-0 place-items-center rounded-md border ${isComplete ? "border-emerald-500 text-emerald-300" : "border-zinc-700 text-zinc-600"}`}>
                            <span className="material-icons text-[17px]">{isComplete ? "check" : "keyboard"}</span>
                          </span>
                        </div>
                      )}

                      {submitted && !isComplete && (task.solutionText || task.solutionImage || task.solutions.length > 0) && (
                        <div className="mt-3 border-t border-rose-950 pt-3">
                          <p className="font-mono text-[10px] uppercase text-rose-300">Solution</p>
                          {task.solutionText && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{task.solutionText}</p>}
                          {task.solutionImage && (
                            <img className="mt-3 max-h-56 w-full rounded border border-zinc-700 object-contain" src={task.solutionImage} alt="" />
                          )}
                          {task.solutions.length > 0 && (
                            <div className="mt-3">
                              <p className="font-mono text-[10px] uppercase text-zinc-500">Accepted {task.solutions.length === 1 ? "answer" : "answers"}</p>
                              <ul className="mt-2 space-y-1">
                                {task.solutions.map((solution) => (
                                  <li key={solution}><code className="font-mono text-xs text-zinc-300">{solution}</code></li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {total > 0 && (
          <button
            className="mt-5 flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white outline-none hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            type="button"
            onClick={onSubmit}
            disabled={submitted || !labReady}
          >
            <span className="material-icons text-[18px]">{submitted ? "done" : labReady ? "task_alt" : "hourglass_empty"}</span>
            <span>{submitted ? `Submitted in ${formatElapsed(elapsedSeconds)}` : labReady ? "Submit lab" : "Preparing lab"}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default function TerminalSandbox() {
  const hostRef = useRef(null);
  const terminalRef = useRef(null);
  const inputBufferRef = useRef("");
  const [bootId, setBootId] = useState(0);
  const [status, setStatus] = useState({ state: "loading", detail: "Linux image" });
  const [sessionState, setSessionState] = useState({ quest: null, scene: null });
  const [questLayout, setQuestLayout] = useState("vertical");
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [answers, setAnswers] = useState({});
  const [commandHistory, setCommandHistory] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    let disposed = false;
    let emulator = null;
    let terminal = null;
    let inputDisposable = null;
    let resizeObserver = null;
    let bootTimeout = null;
    let flushHandle = null;
    let pendingOutput = "";

    async function boot() {
      const session = readSandboxSession(window.location.search);
      const { scene } = session;
      const previousQueue = [...session.previousEntries];
      const currentCommand = session.current;
      setSessionState({ quest: session.quest, scene });
      setQuestLayout(scene.questLayout);
      setCompletedSteps(new Set());
      setAnswers({});
      setCommandHistory([]);
      setSubmitted(false);
      setSubmittedAt(null);
      setStartedAt(null);
      setNow(Date.now());
      inputBufferRef.current = "";
      setBootError("");
      setStatus({ state: "loading", detail: "Linux image" });

      try {
        const canBootProfile = AVAILABLE_PROFILES.has(scene.profile)
          || (scene.profile === "custom" && scene.custom.bzimageUrl);
        if (!canBootProfile) {
          setStatus({ state: "offline", detail: `${DISTRO_LABELS[scene.profile]} unavailable` });
          setBootError(`${DISTRO_LABELS[scene.profile]} is a planned profile. Buildroot is the only bundled image right now.`);
          return;
        }

        globalThis.global = globalThis;
        if (typeof globalThis.setImmediate !== "function") {
          globalThis.setImmediate = (callback, ...args) => globalThis.setTimeout(callback, 0, ...args);
          globalThis.clearImmediate = (handle) => globalThis.clearTimeout(handle);
        }
        const [{ Terminal }, { FitAddon }, v86Module] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("v86"),
        ]);

        if (disposed || !hostRef.current) return;

        const accent = TERMINAL_ACCENTS[scene.accent] || TERMINAL_ACCENTS.cyan;
        terminal = new Terminal({
          allowTransparency: false,
          convertEol: true,
          cursorBlink: true,
          cursorStyle: "bar",
          fontFamily: '"Fira Code", "Cascadia Mono", Consolas, monospace',
          fontSize: 14,
          lineHeight: 1.28,
          scrollback: 5000,
          scrollOnUserInput: true,
          theme: {
            background: "#0b0c0e",
            foreground: "#e4e4e7",
            cursor: accent.cursor,
            cursorAccent: "#0b0c0e",
            selectionBackground: accent.selection,
            black: "#09090b",
            red: "#fb7185",
            green: "#86efac",
            yellow: "#facc15",
            blue: "#60a5fa",
            magenta: "#f0abfc",
            cyan: "#67e8f9",
            white: "#e4e4e7",
            brightBlack: "#71717a",
            brightRed: "#fda4af",
            brightGreen: "#bbf7d0",
            brightYellow: "#fde047",
            brightBlue: "#93c5fd",
            brightMagenta: "#f5d0fe",
            brightCyan: "#a5f3fc",
            brightWhite: "#fafafa",
          },
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(hostRef.current);
        terminalRef.current = terminal;

        const fit = () => {
          if (disposed || !terminal?.element) return;
          try {
            fitAddon.fit();
          } catch {
            // The split can briefly report zero dimensions during hydration.
          }
        };

        window.setTimeout(fit, 80);
        window.setTimeout(fit, 240);

        requestAnimationFrame(() => {
          fit();
          terminal?.focus();
        });

        resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(hostRef.current);
        terminal.writeln(`\u001b[38;5;45mStarting disposable ${DISTRO_LABELS[scene.profile]} Linux...\u001b[0m`);

        const V86 = v86Module.V86 || v86Module.default;
        let phase = "booting";
        let serialTail = "";
        let renderedPrompt = "";
        let setupMarkerSeen = false;
        let queuedCommandRunning = false;

        function flushOutput() {
          flushHandle = null;
          if (!disposed && terminal && pendingOutput) terminal.write(pendingOutput);
          pendingOutput = "";
        }

        function writeOutput(value) {
          pendingOutput += value;
          if (flushHandle === null) flushHandle = requestAnimationFrame(flushOutput);
        }

        function finishQueue() {
          phase = "ready";
          queuedCommandRunning = false;
          setStatus({ state: "ready", detail: "fresh session" });
          setStartedAt(Date.now());
          setNow(Date.now());
          terminal?.focus();
        }

        function promptText() {
          return `${scene.user.name}@${scene.hostname}:${scene.cwd}${scene.user.name === "root" ? "#" : "$"} `;
        }

        function insertCurrentCommand() {
          if (!currentCommand || !emulator) return;
          inputBufferRef.current = currentCommand;
          emulator.serial0_send(currentCommand);
        }

        function writeHistoryEntry(entry) {
          if (!terminal) return;
          terminal.write(`${entry.command}\r\n`);
          if (entry.output) terminal.write(`${entry.output.replace(/\n/g, "\r\n")}\r\n`);
          terminal.write(renderedPrompt || promptText());
        }

        function runNextQueuedCommand() {
          if (disposed || !emulator) return;
          const entry = previousQueue.shift();
          if (!entry) {
            finishQueue();
            insertCurrentCommand();
            return;
          }

          if (!entry.run) {
            writeHistoryEntry(entry);
            queueMicrotask(runNextQueuedCommand);
            return;
          }

          phase = "replaying";
          queuedCommandRunning = true;
          serialTail = "";
          setStatus({ state: "running", detail: `${previousQueue.length + 1} queued` });
          emulator.serial0_send(`${entry.command}\n`);
        }

        function showShell() {
          if (!terminal || disposed) return;
          if (bootTimeout !== null) window.clearTimeout(bootTimeout);
          const fallbackPrompt = `${scene.user.name}@${scene.hostname}:${scene.cwd}${scene.user.name === "root" ? "#" : "$"} `;
          const prompt = finalPrompt(serialTail, fallbackPrompt);
          renderedPrompt = prompt;
          phase = "ready";
          serialTail = "";
          terminal.reset();
          terminal.write(prompt);
          setStatus({ state: "ready", detail: "fresh session" });

          if (previousQueue.length) queueMicrotask(runNextQueuedCommand);
          else {
            insertCurrentCommand();
            setStartedAt(Date.now());
            setNow(Date.now());
            terminal.focus();
          }
        }

        const bzimage = scene.profile === "custom"
          ? {
            url: scene.custom.bzimageUrl,
            ...(scene.custom.bzimageSize ? { size: scene.custom.bzimageSize } : {}),
            async: false,
          }
          : {
            url: "/buildroot-bzimage.bin",
            size: BUILDROOT_IMAGE_SIZE,
            async: false,
          };

        emulator = new V86({
          wasm_path: "/v86.wasm",
          memory_size: 64 * 1024 * 1024,
          vga_memory_size: 2 * 1024 * 1024,
          bios: { url: "/bios/seabios.bin" },
          vga_bios: { url: "/bios/vgabios.bin" },
          bzimage,
          filesystem: {},
          cmdline: scene.profile === "custom" && scene.custom.cmdline
            ? scene.custom.cmdline
            : "tsc=reliable mitigations=off random.trust_cpu=on",
          autostart: true,
          disable_keyboard: true,
          disable_mouse: true,
          disable_speaker: true,
        });

        inputDisposable = terminal.onData((data) => {
          if (!emulator || !["ready", "interactive", "replaying"].includes(phase)) return;
          if (phase !== "replaying") {
            for (const char of data) {
              if (char === "\r" || char === "\n") {
                const command = inputBufferRef.current.trim();
                inputBufferRef.current = "";
                if (command) setCommandHistory((current) => [...current, command].slice(-200));
              } else if (char === "\u007f") {
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              } else if (char === "\u0003") {
                inputBufferRef.current = "";
              } else if (char >= " ") {
                inputBufferRef.current += char;
              }
            }
          }
          if (phase !== "replaying") phase = "interactive";
          emulator.serial0_send(data);
        });

        emulator.add_listener("emulator-ready", () => {
          if (!disposed) setStatus({ state: "booting", detail: "Linux kernel" });
        });

        emulator.add_listener("download-progress", (progress) => {
          if (disposed || !progress?.total) return;
          const percent = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
          setStatus({ state: "loading", detail: `${percent}%` });
        });

        emulator.add_listener("download-error", () => {
          if (disposed) return;
          setBootError("The Linux image could not be loaded.");
          setStatus({ state: "offline", detail: "image unavailable" });
        });

        emulator.add_listener("serial0-output-byte", (byte) => {
          if (disposed) return;
          const char = String.fromCharCode(byte);
          serialTail = `${serialTail}${char}`.slice(-4096);

          if (phase === "booting") {
            if (hasPromptAtEnd(serialTail)) {
              phase = "switching-user";
              serialTail = "";
              setStatus({ state: "preparing", detail: "scene" });
              emulator.serial0_send(buildRootSetup(scene));
            }
            return;
          }

          if (phase === "switching-user") {
            if (hasPromptAtEnd(serialTail)) {
              phase = "setting-up";
              serialTail = "";
              emulator.serial0_send(buildShellSetup(
                scene,
                terminal?.cols || 80,
                terminal?.rows || 24,
                READY_MARKER,
              ));
            }
            return;
          }

          if (phase === "setting-up") {
            if (serialTail.includes(READY_MARKER)) setupMarkerSeen = true;
            if (setupMarkerSeen && hasPromptAtEnd(serialTail)) showShell();
            return;
          }

          writeOutput(char);

          if (phase === "replaying" && queuedCommandRunning && hasPromptAtEnd(serialTail)) {
            queuedCommandRunning = false;
            queueMicrotask(runNextQueuedCommand);
          }
        });

        bootTimeout = window.setTimeout(() => {
          if (disposed || !["booting", "switching-user", "setting-up"].includes(phase)) return;
          setBootError("Linux took too long to reach its shell.");
          setStatus({ state: "offline", detail: "boot timed out" });
        }, 30000);
      } catch (error) {
        if (disposed) return;
        setBootError(error instanceof Error ? error.message : "Linux could not start.");
        setStatus({ state: "offline", detail: "boot failed" });
      }
    }

    boot();

    return () => {
      disposed = true;
      if (bootTimeout !== null) window.clearTimeout(bootTimeout);
      if (flushHandle !== null) cancelAnimationFrame(flushHandle);
      resizeObserver?.disconnect();
      inputDisposable?.dispose();
      emulator?.destroy();
      terminal?.dispose();
      if (terminalRef.current === terminal) terminalRef.current = null;
    };
  }, [bootId]);

  useEffect(() => {
    if (submitted || !startedAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, submitted]);

  useEffect(() => {
    if (!submitted) {
      setCompletedSteps(new Set());
      return;
    }

    const quest = sessionState.quest;
    if (!quest) return;
    const completed = new Set();
    for (const task of taskListForQuest(quest)) {
      const typedMatch = commandHistory.some((command) => taskMatchesCommand(task, command));
      const answerMatch = taskMatchesInput(task, answers[task.id]);
      if (typedMatch || answerMatch) completed.add(task.id);
    }

    setCompletedSteps(completed);
  }, [answers, commandHistory, sessionState.quest, submitted]);

  function restart() {
    setBootError("");
    setBootId((value) => value + 1);
  }

  function focusTerminal(event) {
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    terminalRef.current?.focus();
  }

  function answerTask(task, value) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [task.id]: value }));
  }

  function submitQuest() {
    setSubmitted(true);
    setSubmittedAt(Date.now());
    setNow(Date.now());
  }

  function changeProfile(profile) {
    const scene = sessionState.scene;
    if (!scene || !DISTRO_PROFILES.includes(profile)) return;

    const nextScene = { ...scene, profile };
    if (profile === "custom") {
      const bzimageUrl = window.prompt("Custom bzImage URL");
      if (!bzimageUrl) return;
      nextScene.custom = { ...scene.custom, bzimageUrl };
    }

    const params = new URLSearchParams(window.location.search);
    params.set("s", encodeBase64Url(JSON.stringify(nextScene)));
    window.location.search = params.toString();
  }

  const quest = sessionState.quest;
  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor(((submittedAt || now) - startedAt) / 1000))
    : 0;
  const workspaceClass = quest
    ? questLayout === "horizontal"
      ? "grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
      : "grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1"
    : "block";

  return (
    <main className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0b0c0e] text-zinc-100">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-2 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <a
            className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 outline-none hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-400"
            href="/introduction/welcome"
            title="Back to notes"
            aria-label="Back to notes"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
          </a>
          <span className="material-icons text-[17px] text-blue-400" aria-hidden="true">terminal</span>
          <span className="truncate font-mono text-xs text-zinc-100">/sandbox</span>
          <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">
            {DISTRO_LABELS[sessionState.scene?.profile] || "Buildroot"}
          </span>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <Status state={status.state} detail={status.detail} />
        </div>

        <div className="flex min-w-0 flex-1 justify-end gap-1">
          {!quest && (
            <label className="hidden items-center gap-2 sm:flex">
              <span className="sr-only">Distro profile</span>
              <select
                className="h-8 max-w-36 rounded-md border border-zinc-700 bg-zinc-900 px-2 font-mono text-[11px] text-zinc-300 outline-none hover:border-zinc-600 focus-visible:ring-2 focus-visible:ring-blue-400"
                value={sessionState.scene?.profile || "buildroot"}
                onChange={(event) => changeProfile(event.target.value)}
              >
                {DISTRO_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {DISTRO_LABELS[profile]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {quest && (
            <button
              className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 outline-none hover:bg-zinc-700 hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-400"
              type="button"
              title={questLayout === "vertical" ? "Use horizontal split" : "Use vertical split"}
              aria-label={questLayout === "vertical" ? "Use horizontal split" : "Use vertical split"}
              onClick={() => setQuestLayout((value) => value === "vertical" ? "horizontal" : "vertical")}
            >
              <span className="material-icons text-[18px]">
                {questLayout === "vertical" ? "horizontal_split" : "vertical_split"}
              </span>
            </button>
          )}
          <button
            className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 outline-none hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-400"
            type="button"
            title="Restart sandbox"
            aria-label="Restart sandbox"
            onClick={restart}
          >
            <span className="material-icons text-[18px]">restart_alt</span>
          </button>
        </div>
      </header>

      <div className={`min-h-0 min-w-0 flex-1 ${workspaceClass}`}>
        <section
          className="relative min-h-0 min-w-0 cursor-text overflow-hidden bg-[#0b0c0e] px-2 py-2 sm:px-3 sm:py-2.5"
          role="application"
          aria-label="Disposable Buildroot Linux terminal"
          tabIndex={0}
          onPointerDown={focusTerminal}
        >
          <div ref={hostRef} className="h-full min-h-0 w-full" data-testid="linux-terminal" />

          {bootError && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-rose-800 bg-[#241014] px-3 py-2 text-sm text-rose-100">
              <span className="min-w-0 truncate">{bootError}</span>
              <button
                className="grid size-8 shrink-0 place-items-center rounded-md text-rose-100 outline-none hover:bg-rose-900 focus-visible:ring-2 focus-visible:ring-rose-300"
                type="button"
                title="Retry"
                aria-label="Retry"
                onClick={restart}
              >
                <span className="material-icons text-[18px]">restart_alt</span>
              </button>
            </div>
          )}
        </section>

        {quest && (
          <QuestPanel
            quest={quest}
            completed={completedSteps}
            answers={answers}
            onAnswer={answerTask}
            layout={questLayout}
            commandCount={commandHistory.length}
            submitted={submitted}
            elapsedSeconds={elapsedSeconds}
            submittedAt={submittedAt}
            onSubmit={submitQuest}
            labReady={Boolean(startedAt)}
          />
        )}
      </div>
    </main>
  );
}
