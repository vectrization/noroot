import { useEffect, useMemo, useState } from "react";

import {
  allSandboxUrlCombinations,
  buildSandboxUrl,
  encodeSandboxPayloads,
} from "../lib/sandbox/url-builder.js";
import { DISTRO_PROFILES } from "../lib/sandbox/url-session.js";

const DISTRO_LABELS = {
  buildroot: "Buildroot",
  "debian-light": "Debian light",
  "kali-terminal": "Kali terminal",
  custom: "Custom image",
};

const DEFAULT_PREVIOUS = [
  { id: "previous-1", command: "whoami", behavior: "display", output: "student" },
];

const DEFAULT_FILES = [
  {
    id: "file-1",
    path: "/workspace",
    type: "directory",
    content: "",
    mode: "755",
    owner: "student",
    group: "student",
  },
  {
    id: "file-2",
    path: "/workspace/mission.txt",
    type: "file",
    content: "Find this file, inspect its permissions, then protect it.\n",
    mode: "644",
    owner: "student",
    group: "student",
  },
];

const DEFAULT_ENVIRONMENT = [
  { id: "environment-1", name: "LESSON", value: "permissions" },
  { id: "environment-2", name: "EDITOR", value: "vi" },
];

const DEFAULT_TASKS = [
  {
    required: true,
    label: "What's the working directory?",
    hint: "Use the command that prints the current directory.",
    solutions: "/workspace",
    solutionText: "The lab starts in /workspace. The pwd command prints the current working directory.",
    requiresInput: true,
    score: 1,
  },
  {
    required: true,
    label: "Inspect mission.txt",
    hint: "Use a long listing so permissions are visible.",
    solutions: "ls -la\nls -l",
    solutionText: "A long listing shows hidden entries and permission bits for mission.txt.",
    requiresInput: false,
    score: 3,
  },
  {
    required: true,
    label: "Set mission.txt mode to 600",
    hint: "Use chmod with the numeric mode and the file name.",
    solutions: "chmod 600 mission.txt",
    solutionText: "Mode 600 gives the owner read and write access while removing access for the group and others.",
    requiresInput: false,
    score: 5,
  },
];

const FIELD_CLASS = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-60";
const LABEL_CLASS = "block text-xs font-medium text-zinc-400";
const ICON_BUTTON = "grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 outline-none hover:bg-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-40";
const SECONDARY_BUTTON = "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm font-medium text-zinc-200 outline-none hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-[0.98]";

let nextLocalId = 1;

function localId(prefix) {
  nextLocalId += 1;
  return `${prefix}-${nextLocalId}`;
}

function parseJson(value, label, check, errors) {
  try {
    const parsed = JSON.parse(value);
    if (!check(parsed)) throw new Error(`Expected ${label.toLowerCase()}`);
    return parsed;
  } catch (error) {
    errors[label] = error instanceof Error ? error.message : `Invalid ${label.toLowerCase()}`;
    return null;
  }
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-rose-300">{children}</p>;
}

function CopyButton({ value, id, copied, onCopy, label = "Copy" }) {
  return (
    <button
      className={ICON_BUTTON}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onCopy(value, id)}
    >
      <span className="material-icons text-[17px]">{copied === id ? "check" : "content_copy"}</span>
    </button>
  );
}

function ParameterHeading({ code, title }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <code className="mt-0.5 grid size-7 shrink-0 place-items-center rounded bg-blue-500/10 font-mono text-xs font-semibold text-blue-300">
        {code}
      </code>
      <h2 className="min-w-0 text-base font-semibold text-zinc-100">{title}</h2>
    </div>
  );
}

function taskToPayload(task) {
  return {
    required: task.required,
    label: task.label,
    hint: task.hint,
    solutions: task.solutions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    solutionText: task.solutionText,
    solutionImage: null,
    requiresInput: task.requiresInput,
    score: Number(task.score) || 0,
  };
}

function fileDepth(path) {
  return Math.max(0, String(path).split("/").filter(Boolean).length - 1);
}

function PreviousCommandsEditor({ entries, onChange }) {
  function update(id, patch) {
    onChange(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-zinc-700">
        {entries.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">No previous commands.</div>
        )}
        <div className="divide-y divide-zinc-800">
          {entries.map((entry, index) => (
            <div key={entry.id} className="bg-zinc-900/40 p-3 sm:p-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2rem] sm:items-center">
                <span className="hidden font-mono text-xs text-zinc-600 sm:block">{index + 1}</span>
                <input
                  className={`${FIELD_CLASS} font-mono`}
                  value={entry.command}
                  onChange={(event) => update(entry.id, { command: event.target.value })}
                  aria-label={`Previous command ${index + 1}`}
                  placeholder="command"
                />
                <select
                  className={`${FIELD_CLASS} font-mono text-xs`}
                  value={entry.behavior}
                  onChange={(event) => update(entry.id, { behavior: event.target.value })}
                  aria-label={`Previous command ${index + 1} behavior`}
                >
                  <option value="run">Run</option>
                  <option value="display">Display output</option>
                </select>
                <button
                  className={ICON_BUTTON}
                  type="button"
                  title="Remove command"
                  aria-label={`Remove previous command ${index + 1}`}
                  onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}
                >
                  <span className="material-icons text-[17px]">delete</span>
                </button>
              </div>
              {entry.behavior === "display" && (
                <textarea
                  className={`${FIELD_CLASS} mt-3 min-h-20 resize-y font-mono text-xs leading-5 sm:ml-8 sm:w-[calc(100%-2rem)]`}
                  value={entry.output}
                  onChange={(event) => update(entry.id, { output: event.target.value })}
                  aria-label={`Output for previous command ${index + 1}`}
                  placeholder="Recorded output"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        className={`${SECONDARY_BUTTON} mt-3`}
        type="button"
        onClick={() => onChange([...entries, { id: localId("previous"), command: "", behavior: "run", output: "" }])}
      >
        <span className="material-icons text-[17px]">add</span>
        Add command
      </button>
    </div>
  );
}

function FilesystemEditor({ files, onChange, username, error }) {
  function update(id, patch) {
    onChange(files.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function add(type) {
    onChange([...files, {
      id: localId("file"),
      path: type === "directory" ? "/workspace/new-directory" : "/workspace/new-file.txt",
      type,
      content: "",
      mode: type === "directory" ? "755" : "644",
      owner: username || "user",
      group: username || "user",
    }]);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-950/30">
        <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-3 py-2">
          <span className="material-icons text-[18px] text-blue-300">folder</span>
          <code className="font-mono text-xs text-zinc-300">/</code>
          <span className="ml-auto text-xs text-zinc-500">{files.length} entries</span>
        </div>
        {files.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">The scene starts with an empty filesystem overlay.</div>
        )}
        <div className="divide-y divide-zinc-800">
          {files.map((entry, index) => {
            const depth = Math.min(4, fileDepth(entry.path));
            return (
              <div key={entry.id} className="p-3 sm:p-4">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_5rem_2rem] sm:items-center">
                  <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
                    <span className="material-icons shrink-0 text-[18px] text-zinc-500">
                      {entry.type === "directory" ? "folder" : "description"}
                    </span>
                    <input
                      className={`${FIELD_CLASS} min-w-0 font-mono text-xs`}
                      value={entry.path}
                      onChange={(event) => update(entry.id, { path: event.target.value })}
                      aria-label={`Filesystem path ${index + 1}`}
                      placeholder="/absolute/path"
                    />
                  </div>
                  <select
                    className={`${FIELD_CLASS} font-mono text-xs`}
                    value={entry.type}
                    onChange={(event) => update(entry.id, {
                      type: event.target.value,
                      mode: event.target.value === "directory" && entry.mode === "644" ? "755" : entry.mode,
                    })}
                    aria-label={`Filesystem entry ${index + 1} type`}
                  >
                    <option value="file">File</option>
                    <option value="directory">Directory</option>
                  </select>
                  <input
                    className={`${FIELD_CLASS} font-mono text-xs`}
                    value={entry.mode}
                    onChange={(event) => update(entry.id, { mode: event.target.value })}
                    aria-label={`Filesystem entry ${index + 1} mode`}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="644"
                  />
                  <button
                    className={ICON_BUTTON}
                    type="button"
                    title="Remove entry"
                    aria-label={`Remove filesystem entry ${index + 1}`}
                    onClick={() => onChange(files.filter((item) => item.id !== entry.id))}
                  >
                    <span className="material-icons text-[17px]">delete</span>
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2" style={{ paddingLeft: `${depth * 12 + 26}px` }}>
                  <div>
                    <label className={LABEL_CLASS} htmlFor={`file-owner-${entry.id}`}>Owner</label>
                    <input id={`file-owner-${entry.id}`} className={`${FIELD_CLASS} mt-1 font-mono text-xs`} value={entry.owner} onChange={(event) => update(entry.id, { owner: event.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor={`file-group-${entry.id}`}>Group</label>
                    <input id={`file-group-${entry.id}`} className={`${FIELD_CLASS} mt-1 font-mono text-xs`} value={entry.group} onChange={(event) => update(entry.id, { group: event.target.value })} />
                  </div>
                </div>

                {entry.type === "file" && (
                  <div className="mt-3" style={{ paddingLeft: `${depth * 12 + 26}px` }}>
                    <label className={LABEL_CLASS} htmlFor={`file-content-${entry.id}`}>Contents</label>
                    <textarea
                      id={`file-content-${entry.id}`}
                      className={`${FIELD_CLASS} mt-1 min-h-24 resize-y font-mono text-xs leading-5`}
                      value={entry.content}
                      onChange={(event) => update(entry.id, { content: event.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={SECONDARY_BUTTON} type="button" onClick={() => add("file")}>
          <span className="material-icons text-[17px]">note_add</span>
          New file
        </button>
        <button className={SECONDARY_BUTTON} type="button" onClick={() => add("directory")}>
          <span className="material-icons text-[17px]">create_new_folder</span>
          New folder
        </button>
      </div>
    </div>
  );
}

function EnvironmentEditor({ variables, onChange, error }) {
  function update(id, patch) {
    onChange(variables.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-zinc-700">
        {variables.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">No custom shell variables.</div>
        )}
        <div className="divide-y divide-zinc-800">
          {variables.map((variable, index) => (
            <div key={variable.id} className="grid min-w-0 gap-2 p-3 sm:grid-cols-[minmax(8rem,0.45fr)_auto_minmax(10rem,1fr)_2rem] sm:items-center">
              <input
                className={`${FIELD_CLASS} font-mono text-xs uppercase`}
                value={variable.name}
                onChange={(event) => update(variable.id, { name: event.target.value })}
                aria-label={`Environment variable ${index + 1} name`}
                placeholder="NAME"
              />
              <span className="hidden font-mono text-zinc-600 sm:block">=</span>
              <input
                className={`${FIELD_CLASS} font-mono text-xs`}
                value={variable.value}
                onChange={(event) => update(variable.id, { value: event.target.value })}
                aria-label={`Environment variable ${index + 1} value`}
                placeholder="value"
              />
              <button
                className={ICON_BUTTON}
                type="button"
                title="Remove variable"
                aria-label={`Remove environment variable ${index + 1}`}
                onClick={() => onChange(variables.filter((item) => item.id !== variable.id))}
              >
                <span className="material-icons text-[17px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <button
        className={`${SECONDARY_BUTTON} mt-3`}
        type="button"
        onClick={() => onChange([...variables, { id: localId("environment"), name: "", value: "" }])}
      >
        <span className="material-icons text-[17px]">add</span>
        Add variable
      </button>
    </div>
  );
}

export default function SandboxUrlGenerator() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:4321");
  const [command, setCommand] = useState("echo sandbox ready");
  const [previous, setPrevious] = useState(DEFAULT_PREVIOUS);
  const [chapter, setChapter] = useState("Terminal Basics");
  const [lesson, setLesson] = useState("Permissions");
  const [description, setDescription] = useState("Practice inspecting and changing Unix permissions.");
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [jsonMode, setJsonMode] = useState(false);
  const [questJson, setQuestJson] = useState("");
  const [hostname, setHostname] = useState("permissions-lab");
  const [profile, setProfile] = useState("buildroot");
  const [customBzimageUrl, setCustomBzimageUrl] = useState("");
  const [customBzimageSize, setCustomBzimageSize] = useState("");
  const [customCmdline, setCustomCmdline] = useState("");
  const [username, setUsername] = useState("student");
  const [uid, setUid] = useState("1000");
  const [password, setPassword] = useState("learnlinux");
  const [home, setHome] = useState("/home/student");
  const [cwd, setCwd] = useState("/workspace");
  const [layout, setLayout] = useState("vertical");
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [environment, setEnvironment] = useState(DEFAULT_ENVIRONMENT);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const questFromFields = useMemo(() => ({
    chapter,
    lesson,
    description,
    scoringEnabled,
    tasks: tasks.map(taskToPayload).filter((task) => task.label.trim()),
  }), [chapter, description, lesson, scoringEnabled, tasks]);

  const generated = useMemo(() => {
    const errors = {};
    const questValue = jsonMode
      ? parseJson(questJson, "Quest", (value) => value && typeof value === "object" && !Array.isArray(value), errors)
      : questFromFields;
    const uidValue = Number(uid);

    if (!Number.isInteger(uidValue) || uidValue < 0 || uidValue > 60000) {
      errors.Uid = "UID must be an integer from 0 to 60000";
    }

    const previousValue = previous
      .filter((entry) => entry.command.trim())
      .map((entry) => entry.behavior === "display"
        ? { command: entry.command, output: entry.output }
        : { command: entry.command });

    const filesValue = files
      .filter((entry) => entry.path.trim())
      .map(({ id: _id, ...entry }) => entry);
    const paths = new Set();
    for (const entry of filesValue) {
      if (!entry.path.startsWith("/")) errors.Files = "Every filesystem path must be absolute and start with /.";
      if (!/^[0-7]{3,4}$/.test(entry.mode)) errors.Files = "File modes must contain three or four octal digits, such as 644 or 0755.";
      if (paths.has(entry.path)) errors.Files = `Duplicate filesystem path: ${entry.path}`;
      paths.add(entry.path);
    }

    const environmentValue = {};
    for (const variable of environment) {
      const name = variable.name.trim();
      if (!name && !variable.value) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        errors.Environment = "Variable names must look like EDITOR or LESSON_NAME.";
        continue;
      }
      if (Object.hasOwn(environmentValue, name)) errors.Environment = `Duplicate environment variable: ${name}`;
      environmentValue[name] = variable.value;
    }

    let origin = baseUrl;
    try {
      origin = new URL(baseUrl).origin;
    } catch {
      errors.Origin = "Enter an absolute URL, including http:// or https://";
    }

    if (Object.keys(errors).length) {
      return { errors, payloads: null, combinations: [], shareUrl: "" };
    }

    const values = {
      c: command,
      p: previousValue,
      q: questValue,
      s: {
        profile,
        hostname,
        user: { name: username, uid: uidValue, password, home },
        cwd,
        questLayout: layout,
        files: filesValue,
        env: environmentValue,
        custom: {
          bzimageUrl: customBzimageUrl,
          bzimageSize: Number(customBzimageSize) || null,
          cmdline: customCmdline,
        },
      },
    };

    return {
      errors,
      payloads: encodeSandboxPayloads(values),
      combinations: allSandboxUrlCombinations(origin, values),
      shareUrl: buildSandboxUrl(origin, values, ["o"]),
    };
  }, [
    baseUrl,
    command,
    cwd,
    customBzimageSize,
    customBzimageUrl,
    customCmdline,
    environment,
    files,
    home,
    hostname,
    jsonMode,
    layout,
    password,
    previous,
    profile,
    questFromFields,
    questJson,
    uid,
    username,
  ]);

  async function copy(value, id) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => current === id ? "" : current), 1200);
    } catch {
      setCopied("");
    }
  }

  function updateTask(index, patch) {
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  function addTask() {
    setTasks((current) => [...current, {
      required: true,
      label: "",
      hint: "",
      solutions: "",
      solutionText: "",
      requiresInput: false,
      score: 1,
    }]);
  }

  function enableJsonMode() {
    setQuestJson(JSON.stringify(questFromFields, null, 2));
    setJsonMode(true);
  }

  const navItems = [
    ["c", "Current command", "#current-command"],
    ["p", "Previous commands", "#previous-commands"],
    ["q", "Lab", "#lab"],
    ["s", "Scene", "#scene"],
  ];

  return (
    <main className="min-h-[100dvh] bg-zinc-900 text-zinc-200">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-3 sm:px-5">
        <a className={ICON_BUTTON} href="/sandbox" title="Back to sandbox" aria-label="Back to sandbox">
          <span className="material-icons text-[18px]">arrow_back</span>
        </a>
        <span className="material-icons text-[18px] text-blue-400" aria-hidden="true">link</span>
        <h1 className="min-w-0 truncate text-sm font-semibold text-zinc-100">Lab creator</h1>
      </header>

      <div className="grid min-h-[calc(100dvh-3rem)] md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_22rem]">
        <aside className="hidden border-r border-zinc-700 bg-zinc-800 md:block">
          <div className="sticky top-12 p-5">
            <p className="mb-4 text-xs font-semibold uppercase text-zinc-400">Payload</p>
            <nav aria-label="Sandbox URL sections">
              <ul className="space-y-1 text-sm">
                {navItems.map(([code, label, href]) => (
                  <li key={code}>
                    <a className="flex items-center gap-3 rounded-md px-2 py-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" href={href}>
                      <code className="w-4 font-mono text-xs text-blue-400">{code}</code>
                      <span>{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <section className="min-w-0 bg-zinc-900">
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-7 lg:py-10">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-100">Create a lab</h2>
            </div>

            <div className="border-y border-zinc-800">
              <fieldset id="current-command" className="scroll-mt-20 py-8">
                <ParameterHeading code="c" title="Current command" />
                <label className={LABEL_CLASS} htmlFor="command">Command line</label>
                <textarea id="command" className={`${FIELD_CLASS} mt-1 min-h-20 resize-y font-mono`} value={command} onChange={(event) => setCommand(event.target.value)} />
                <p className="mt-2 text-xs text-zinc-500">Prefilled, not run.</p>
              </fieldset>

              <fieldset id="previous-commands" className="scroll-mt-20 border-t border-zinc-800 py-8">
                <ParameterHeading code="p" title="Previous commands" />
                <PreviousCommandsEditor entries={previous} onChange={setPrevious} />
              </fieldset>

              <fieldset id="lab" className="scroll-mt-20 border-t border-zinc-800 py-8">
                <ParameterHeading code="q" title="Lab" />
                {!jsonMode ? (
                  <div className="space-y-5">
                    <p className="border-l-2 border-amber-400 pl-3 text-xs leading-5 text-zinc-400">
                      Results stay on the learner's device. You cannot receive them through this link; ask the learner to screenshot the completion summary.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={LABEL_CLASS} htmlFor="chapter">Chapter</label>
                        <input id="chapter" className={`${FIELD_CLASS} mt-1`} value={chapter} onChange={(event) => setChapter(event.target.value)} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS} htmlFor="lesson">Lesson</label>
                        <input id="lesson" className={`${FIELD_CLASS} mt-1`} value={lesson} onChange={(event) => setLesson(event.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLASS} htmlFor="description">Description</label>
                      <textarea id="description" className={`${FIELD_CLASS} mt-1 min-h-20 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} />
                    </div>

                    <label className="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-300">
                      <input className="size-4 accent-blue-500" type="checkbox" checked={scoringEnabled} onChange={(event) => setScoringEnabled(event.target.checked)} />
                      Calculate a percentage when the learner submits
                    </label>

                    <div className="overflow-hidden rounded-md border border-zinc-700">
                      <div className="divide-y divide-zinc-800">
                        {tasks.map((task, index) => (
                          <div key={index} className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="font-mono text-xs text-zinc-500">Task {index + 1}</span>
                              <button className={ICON_BUTTON} type="button" title="Remove task" aria-label={`Remove task ${index + 1}`} onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))}>
                                <span className="material-icons text-[17px]">delete</span>
                              </button>
                            </div>
                            <div className="grid gap-3">
                              <div>
                                <label className={LABEL_CLASS} htmlFor={`task-label-${index}`}>Instruction</label>
                                <input id={`task-label-${index}`} className={`${FIELD_CLASS} mt-1`} value={task.label} onChange={(event) => updateTask(index, { label: event.target.value })} />
                              </div>
                              <div>
                                <label className={LABEL_CLASS} htmlFor={`task-hint-${index}`}>Hint</label>
                                <input id={`task-hint-${index}`} className={`${FIELD_CLASS} mt-1`} value={task.hint} onChange={(event) => updateTask(index, { hint: event.target.value })} />
                              </div>
                              <div>
                                <label className={LABEL_CLASS} htmlFor={`task-solutions-${index}`}>Accepted solutions, one per line</label>
                                <textarea id={`task-solutions-${index}`} className={`${FIELD_CLASS} mt-1 min-h-20 resize-y font-mono text-xs leading-5`} value={task.solutions} onChange={(event) => updateTask(index, { solutions: event.target.value })} />
                              </div>
                              <div>
                                <label className={LABEL_CLASS} htmlFor={`task-solution-text-${index}`}>Solution explanation</label>
                                <textarea id={`task-solution-text-${index}`} className={`${FIELD_CLASS} mt-1 min-h-20 resize-y`} value={task.solutionText} onChange={(event) => updateTask(index, { solutionText: event.target.value })} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                                <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                                  <label className="flex items-center gap-2">
                                    <input className="size-4 accent-blue-500" type="checkbox" checked={task.required} onChange={(event) => updateTask(index, { required: event.target.checked })} />
                                    Required
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input className="size-4 accent-blue-500" type="checkbox" checked={task.requiresInput} onChange={(event) => updateTask(index, { requiresInput: event.target.checked })} />
                                    Written answer
                                  </label>
                                </div>
                                <div>
                                  <label className={LABEL_CLASS} htmlFor={`task-score-${index}`}>Score</label>
                                  <input id={`task-score-${index}`} className={`${FIELD_CLASS} mt-1 font-mono`} type="number" min="0" value={task.score} onChange={(event) => updateTask(index, { score: event.target.value })} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className={SECONDARY_BUTTON} type="button" onClick={addTask}>
                        <span className="material-icons text-[17px]">add</span>
                        Add task
                      </button>
                      <button className={SECONDARY_BUTTON} type="button" onClick={enableJsonMode}>
                        <span className="material-icons text-[17px]">data_object</span>
                        Edit quest JSON
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={LABEL_CLASS} htmlFor="quest-json">Quest JSON</label>
                    <textarea id="quest-json" className={`${FIELD_CLASS} mt-1 min-h-72 resize-y font-mono text-xs leading-5`} value={questJson} onChange={(event) => setQuestJson(event.target.value)} aria-invalid={Boolean(generated.errors.Quest)} />
                    <FieldError>{generated.errors.Quest}</FieldError>
                    <button className={`${SECONDARY_BUTTON} mt-3`} type="button" onClick={() => setJsonMode(false)}>
                      <span className="material-icons text-[17px]">tune</span>
                      Back to fields
                    </button>
                  </div>
                )}
              </fieldset>

              <fieldset id="scene" className="scroll-mt-20 border-t border-zinc-800 py-8">
                <ParameterHeading code="s" title="Scene" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL_CLASS} htmlFor="profile">Distro profile</label>
                    <select id="profile" className={`${FIELD_CLASS} mt-1 font-mono`} value={profile} onChange={(event) => setProfile(event.target.value)}>
                      {DISTRO_PROFILES.map((item) => <option key={item} value={item}>{DISTRO_LABELS[item]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="hostname">Hostname</label>
                    <input id="hostname" className={`${FIELD_CLASS} mt-1 font-mono`} value={hostname} onChange={(event) => setHostname(event.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="username">Username</label>
                    <input id="username" className={`${FIELD_CLASS} mt-1 font-mono`} value={username} onChange={(event) => setUsername(event.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="uid">UID</label>
                    <input id="uid" className={`${FIELD_CLASS} mt-1 font-mono`} type="number" min="0" max="60000" value={uid} onChange={(event) => setUid(event.target.value)} />
                    <FieldError>{generated.errors.Uid}</FieldError>
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="password">Sudo password</label>
                    <input id="password" className={`${FIELD_CLASS} mt-1 font-mono`} value={password} onChange={(event) => setPassword(event.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="home">Home directory</label>
                    <input id="home" className={`${FIELD_CLASS} mt-1 font-mono`} value={home} onChange={(event) => setHome(event.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="cwd">Working directory</label>
                    <input id="cwd" className={`${FIELD_CLASS} mt-1 font-mono`} value={cwd} onChange={(event) => setCwd(event.target.value)} />
                  </div>
                </div>

                {profile === "custom" && (
                  <div className="mt-5 grid gap-4 rounded-md border border-zinc-700 bg-zinc-950/40 p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={LABEL_CLASS} htmlFor="custom-bzimage">Custom bzImage URL</label>
                      <input id="custom-bzimage" className={`${FIELD_CLASS} mt-1 font-mono`} value={customBzimageUrl} onChange={(event) => setCustomBzimageUrl(event.target.value)} placeholder="https://example.com/buildroot-bzimage.bin" />
                    </div>
                    <div>
                      <label className={LABEL_CLASS} htmlFor="custom-size">Image size</label>
                      <input id="custom-size" className={`${FIELD_CLASS} mt-1 font-mono`} type="number" min="1" value={customBzimageSize} onChange={(event) => setCustomBzimageSize(event.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS} htmlFor="custom-cmdline">Kernel command line</label>
                      <input id="custom-cmdline" className={`${FIELD_CLASS} mt-1 font-mono`} value={customCmdline} onChange={(event) => setCustomCmdline(event.target.value)} />
                    </div>
                  </div>
                )}

                <div className="mt-6 border-y border-zinc-800 py-5">
                  <div>
                    <span className={LABEL_CLASS}>Lab split</span>
                    <div className="mt-2 inline-flex rounded-md border border-zinc-700 p-0.5" role="group" aria-label="Lab split">
                      {[["vertical", "vertical_split"], ["horizontal", "horizontal_split"]].map(([value, icon]) => (
                        <button key={value} className={`grid size-8 place-items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${layout === value ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"}`} type="button" title={`${value} split`} aria-label={`${value} split`} aria-pressed={layout === value} onClick={() => setLayout(value)}>
                          <span className="material-icons text-[18px]">{icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-7">
                  <h3 className="text-sm font-semibold text-zinc-100">Filesystem</h3>
                  <p className="mt-1 mb-3 text-xs leading-5 text-zinc-500">Created before the shell opens. Reset on reload.</p>
                  <FilesystemEditor files={files} onChange={setFiles} username={username} error={generated.errors.Files} />
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-zinc-100">Shell environment</h3>
                  <p className="mt-1 mb-3 text-xs leading-5 text-zinc-500">Variables exported inside the guest shell, such as <code className="font-mono text-zinc-300">EDITOR=vi</code>. They do not affect the browser or host.</p>
                  <EnvironmentEditor variables={environment} onChange={setEnvironment} error={generated.errors.Environment} />
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <aside className="min-w-0 border-t border-zinc-800 bg-zinc-950 md:col-start-2 xl:col-start-auto xl:border-l xl:border-t-0">
          <div className="xl:sticky xl:top-12 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
            <div className="border-b border-zinc-800 p-5">
              <label className={LABEL_CLASS} htmlFor="origin">Link origin</label>
              <input id="origin" className={`${FIELD_CLASS} mt-1 min-w-0 font-mono text-xs`} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} aria-invalid={Boolean(generated.errors.Origin)} />
              <FieldError>{generated.errors.Origin}</FieldError>
            </div>

            <div className="border-b border-zinc-800 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-100">Share URL</h2>
                {generated.shareUrl && <CopyButton value={generated.shareUrl} id="share-o" copied={copied} onCopy={copy} label="Copy compact URL" />}
              </div>
              <a className="block truncate font-mono text-xs leading-5 text-blue-400 hover:text-blue-300 hover:underline" href={generated.shareUrl || "#"} target="_blank" rel="noreferrer" title={generated.shareUrl}>
                {generated.shareUrl || "Fix input errors to generate a URL"}
              </a>
              {generated.shareUrl && (
                <a className="mt-4 inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-3 text-sm font-semibold text-white outline-none hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300 active:scale-[0.98]" href={generated.shareUrl} target="_blank" rel="noreferrer">
                  <span className="material-icons text-[17px]">open_in_new</span>
                  Open sandbox
                </a>
              )}
            </div>

            <details className="border-b border-zinc-800 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Encoded payloads</summary>
              <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
                {generated.payloads && Object.entries(generated.payloads).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-2 py-2">
                    <code className="font-mono text-xs font-semibold text-blue-400">{key}</code>
                    <code className="truncate font-mono text-[11px] text-zinc-600" title={value}>{value}</code>
                    <CopyButton value={value} id={`payload-${key}`} copied={copied} onCopy={copy} label={`Copy ${key} payload`} />
                  </div>
                ))}
              </div>
            </details>

            <details className="p-5">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Test matrix ({generated.combinations.length})</summary>
              <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
                {generated.combinations.map((combination) => (
                  <div key={combination.id} className="grid grid-cols-[minmax(4rem,auto)_minmax(0,1fr)_4rem] items-center gap-2 py-2.5">
                    <code className="font-mono text-[11px] font-semibold text-blue-400">{combination.keys.join(" + ")}</code>
                    <a className="min-w-0 truncate font-mono text-[11px] text-zinc-600 outline-none hover:text-blue-400 hover:underline focus-visible:ring-2 focus-visible:ring-blue-400" href={combination.url} target="_blank" rel="noreferrer" title={combination.url}>{combination.url}</a>
                    <div className="flex justify-end">
                      <CopyButton value={combination.url} id={`url-${combination.id}`} copied={copied} onCopy={copy} label={`Copy ${combination.id} URL`} />
                      <a className={ICON_BUTTON} href={combination.url} target="_blank" rel="noreferrer" title={`Open ${combination.id} URL`} aria-label={`Open ${combination.id} URL`}>
                        <span className="material-icons text-[17px]">open_in_new</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </aside>
      </div>
    </main>
  );
}
