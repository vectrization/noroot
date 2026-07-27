const SESSION_LANGUAGES = new Set(["shellsession", "console"]);

export function commandFromPromptLine(line) {
  const promptMatch = line.match(/^.*[$#]\s+(.+)$/);
  return (promptMatch?.[1] || "").trim();
}

export function runnableCodeFor(code, language, executeLines = []) {
  const lines = code.split(/\r?\n/);
  const isSession = SESSION_LANGUAGES.has(language);
  const cleanLine = (line) => isSession ? commandFromPromptLine(line) : line.trim();

  if (executeLines.length > 0) {
    return executeLines
      .map((lineNumber) => cleanLine(lines[lineNumber - 1] || ""))
      .filter(Boolean)
      .join("\n");
  }

  if (isSession) {
    const commandLine = lines.find((line) => commandFromPromptLine(line));
    return commandLine ? commandFromPromptLine(commandLine) : "";
  }

  return lines.find((line) => line.trim())?.trim() || "";
}
