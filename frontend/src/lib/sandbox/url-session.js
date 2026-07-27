const MAX_PAYLOAD_LENGTH = 64 * 1024;
const MAX_COMMANDS = 100;
const MAX_FILES = 100;
const MAX_FILE_CONTENT = 32 * 1024;
const MAX_TASKS = 40;
const USER_PATTERN = /^[a-z_][a-z0-9_-]{0,30}$/;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/i;
const ENV_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MODE_PATTERN = /^[0-7]{3,4}$/;

export const SCENE_ACCENTS = ["cyan", "green", "amber", "magenta"];
export const SANDBOX_STATE_KEYS = ["c", "p", "q", "s"];
export const DISTRO_PROFILES = ["buildroot"];

export function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeBase64Url(value) {
  if (!value || value.length > MAX_PAYLOAD_LENGTH) return null;

  try {
    const normalized = value
      .replace(/ /g, "+")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function validAbsolutePath(value) {
  return typeof value === "string"
    && value.startsWith("/")
    && value.length <= 240
    && !/[\0\r\n]/.test(value);
}

function validAccount(value, fallback) {
  return typeof value === "string" && USER_PATTERN.test(value) ? value : fallback;
}

function limitedText(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodedParam(params, wrapper, key) {
  const direct = decodeBase64Url(params.get(key));
  if (direct !== null) return direct;
  const wrapped = wrapper && Object.hasOwn(wrapper, key) ? wrapper[key] : null;
  if (typeof wrapped === "string") return wrapped;
  if (wrapped !== null && wrapped !== undefined) return JSON.stringify(wrapped);
  return null;
}

function normalizeSolutions(raw) {
  const source = Array.isArray(raw.solutions)
    ? raw.solutions
    : typeof raw.solution === "string"
      ? [raw.solution]
      : [];

  return source
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, 10)
    .map((item) => item.trim().slice(0, 500));
}

function normalizeTask(raw, index) {
  if (typeof raw === "string") {
    const label = raw.trim().slice(0, 500);
    return label ? {
      id: `task-${index + 1}`,
      required: true,
      label,
      hint: "",
      solutions: [],
      solutionText: "",
      solutionImage: null,
      requiresInput: false,
      score: 1,
    } : null;
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const label = limitedText(
    typeof raw.label === "string" ? raw.label.trim() : "",
    500,
  );
  if (!label) return null;

  const score = Number(raw.score);
  const solutionImage = typeof raw.solutionImage === "string" && raw.solutionImage.trim()
    ? raw.solutionImage.trim().slice(0, 2048)
    : null;
  const solutionText = typeof raw.solutionText === "string"
    ? raw.solutionText
    : typeof raw.explanation === "string"
      ? raw.explanation
      : "";

  return {
    id: typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim().slice(0, 80)
      : `task-${index + 1}`,
    required: raw.required !== false,
    label,
    hint: limitedText(typeof raw.hint === "string" ? raw.hint.trim() : "", 1000),
    solutions: normalizeSolutions(raw),
    solutionText: limitedText(solutionText.trim(), 2000),
    solutionImage,
    requiresInput: raw.requiresInput === true,
    score: Number.isFinite(score) && score >= 0 ? Math.min(1000, score) : 1,
  };
}

export function normalizeQuest(value) {
  if (!value) return null;

  const parsed = typeof value === "string" ? parseJson(value) ?? value : value;
  if (typeof parsed === "string") {
    const description = limitedText(parsed.trim(), 4000);
    return description ? {
      chapter: "",
      lesson: "Objective",
      title: "Objective",
      description,
      scoringEnabled: false,
      tasks: [],
      instructions: [],
    } : null;
  }

  if (Array.isArray(parsed)) {
    const tasks = parsed
      .slice(0, MAX_TASKS)
      .map(normalizeTask)
      .filter(Boolean);
    return tasks.length ? {
      chapter: "",
      lesson: "Objective",
      title: "Objective",
      description: "",
      scoringEnabled: false,
      tasks,
      instructions: tasks.map((task) => task.label),
    } : null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const chapter = limitedText(typeof parsed.chapter === "string" ? parsed.chapter.trim() : "", 100);
  const lesson = limitedText(typeof parsed.lesson === "string" ? parsed.lesson.trim() : "", 100);
  const title = limitedText(typeof parsed.title === "string" ? parsed.title.trim() : "", 100)
    || [chapter, lesson].filter(Boolean).join(" / ")
    || "Objective";
  const description = limitedText(
    typeof parsed.description === "string" ? parsed.description.trim() : "",
    4000,
  );
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : parsed.instructions;
  const tasks = Array.isArray(rawTasks)
    ? rawTasks
      .slice(0, MAX_TASKS)
      .map(normalizeTask)
      .filter(Boolean)
    : [];
  const instructions = Array.isArray(parsed.instructions)
    ? parsed.instructions
      .filter((item) => typeof item === "string" && item.trim())
      .slice(0, MAX_TASKS)
      .map((item) => item.trim().slice(0, 500))
    : tasks.map((task) => task.label);

  return description || tasks.length || instructions.length ? {
    chapter,
    lesson,
    title,
    description,
    scoringEnabled: parsed.scoringEnabled === true,
    tasks,
    instructions,
  } : null;
}

function normalizeFiles(rawFiles, defaultOwner) {
  const source = Array.isArray(rawFiles)
    ? rawFiles
    : rawFiles && typeof rawFiles === "object"
      ? Object.entries(rawFiles).map(([path, value]) => ({
        path,
        ...(typeof value === "string" ? { content: value } : value),
      }))
      : [];

  const files = [];
  for (const raw of source) {
    if (!raw || typeof raw !== "object" || !validAbsolutePath(raw.path)) continue;
    const type = raw.type === "directory" || raw.type === "dir" ? "directory" : "file";
    files.push({
      path: raw.path.replace(/\/{2,}/g, "/"),
      type,
      content: type === "file" ? limitedText(raw.content, MAX_FILE_CONTENT) : "",
      mode: MODE_PATTERN.test(String(raw.mode || ""))
        ? String(raw.mode)
        : type === "directory" ? "755" : "644",
      owner: validAccount(raw.owner, defaultOwner),
      group: validAccount(raw.group, defaultOwner),
    });
    if (files.length >= MAX_FILES) break;
  }

  return files;
}

export function normalizeScene(value) {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  const raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const rawUser = typeof raw.user === "string" ? { name: raw.user } : raw.user || {};
  const requestedName = validAccount(rawUser.name, "user");
  const requestedUid = Number.isInteger(rawUser.uid) && rawUser.uid >= 0 && rawUser.uid <= 60000
    ? rawUser.uid
    : requestedName === "root" ? 0 : 1000;
  const name = requestedUid === 0 ? "root" : requestedName === "root" ? "user" : requestedName;
  const uid = name === "root" ? 0 : requestedUid || 1000;
  const defaultHome = name === "root" ? "/root" : `/home/${name}`;
  const home = validAbsolutePath(rawUser.home) ? rawUser.home : defaultHome;
  const password = limitedText(rawUser.password, 64) || name;
  const hostname = typeof raw.hostname === "string" && HOST_PATTERN.test(raw.hostname)
    ? raw.hostname.toLowerCase()
    : "no-root";
  const cwd = validAbsolutePath(raw.cwd) ? raw.cwd : home;
  const env = {};

  if (raw.env && typeof raw.env === "object" && !Array.isArray(raw.env)) {
    for (const [key, item] of Object.entries(raw.env).slice(0, 32)) {
      if (ENV_PATTERN.test(key) && typeof item === "string") env[key] = item.slice(0, 2048);
    }
  }

  return {
    profile: "buildroot",
    hostname,
    user: { name, uid, home, password },
    cwd,
    env,
    files: normalizeFiles(raw.files, name),
    accent: SCENE_ACCENTS.includes(raw.accent) ? raw.accent : "cyan",
    questLayout: raw.questLayout === "horizontal" ? "horizontal" : "vertical",
    custom: {
      bzimageUrl: "",
      bzimageSize: null,
      hdaUrl: "",
      hdaSize: null,
      memorySize: null,
      cmdline: "",
    },
  };
}

function normalizeHistoryItem(item) {
  if (typeof item === "string") return { command: item, output: null, run: true };
  if (Array.isArray(item) && typeof item[0] === "string") {
    return {
      command: item[0],
      output: typeof item[1] === "string" ? item[1] : null,
      run: typeof item[1] !== "string",
    };
  }
  if (item && typeof item.command === "string") {
    const hasOutput = typeof item.output === "string";
    return {
      command: item.command,
      output: hasOutput ? item.output : null,
      run: !hasOutput,
    };
  }
  return null;
}

function appendRunnableCommand(commands, value) {
  if (!value) return;

  for (const line of value.split(/\r?\n/)) {
    const command = line.trim();
    if (command && commands.length < MAX_COMMANDS) commands.push(command);
  }
}

function appendCurrentCommand(currentCommands, value) {
  if (!value) return;
  const command = value.trim();
  if (command && currentCommands.length < MAX_COMMANDS) currentCommands.push(command);
}

export function readSandboxSession(search = "") {
  const params = new URLSearchParams(search);
  const wrappedRaw = decodeBase64Url(params.get("o"));
  const wrapper = parseJson(wrappedRaw);
  const wrappedValues = wrapper && typeof wrapper === "object" && !Array.isArray(wrapper) ? wrapper : null;
  const replayCommands = [];
  const displayHistory = [];
  const previousEntries = [];
  const currentCommands = [];
  const previous = decodedParam(params, wrappedValues, "p");

  if (previous) {
    const history = parseJson(previous);
    if (Array.isArray(history)) {
      for (const item of history) {
        const normalized = normalizeHistoryItem(item);
        if (!normalized) continue;
        const command = normalized.command.trim();
        if (!command) continue;
        displayHistory.push({ ...normalized, command });
        previousEntries.push({ ...normalized, command });
        if (normalized.run) appendRunnableCommand(replayCommands, command);
        if (displayHistory.length >= MAX_COMMANDS) break;
      }
    }
  }

  appendCurrentCommand(currentCommands, decodedParam(params, wrappedValues, "c"));

  return {
    commands: replayCommands,
    replayCommands,
    displayHistory,
    previousEntries,
    current: currentCommands.join("\n"),
    quest: normalizeQuest(decodedParam(params, wrappedValues, "q")),
    scene: normalizeScene(decodedParam(params, wrappedValues, "s")),
  };
}
