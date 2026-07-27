const PROMPT_ACCENTS = {
  cyan: 45,
  green: 114,
  amber: 220,
  magenta: 207,
};

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function parentDirectory(path) {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
}

function sudoScript(password) {
  return `#!/bin/sh
stamp="/tmp/.nra-sudo-${"${USER:-user}"}"

if [ "$(id -u)" -eq 0 ]; then
  [ "$1" = "-k" ] && exit 0
  [ "$1" = "--" ] && shift
  [ "$#" -eq 0 ] && set -- /bin/sh
  exec "$@"
fi

if [ "$1" = "-k" ]; then
  rm -f "$stamp"
  shift
  [ "$#" -eq 0 ] && exit 0
fi

validate_only=0
if [ "$1" = "-v" ]; then
  validate_only=1
  shift
fi

now=$(date +%s)
last=0
[ -f "$stamp" ] && last=$(cat "$stamp" 2>/dev/null)
case "$last" in ""|*[!0-9]*) last=0 ;; esac

if [ $((now - last)) -ge 300 ]; then
  printf '[sudo] password for %s: ' "${"${USER:-user}"}" > /dev/tty
  trap 'stty echo < /dev/tty 2>/dev/null' EXIT HUP INT TERM
  stty -echo < /dev/tty 2>/dev/null
  IFS= read -r answer < /dev/tty
  stty echo < /dev/tty 2>/dev/null
  trap - EXIT HUP INT TERM
  printf '\n' > /dev/tty

  if [ "$answer" != ${shellQuote(password)} ]; then
    echo 'Sorry, try again.' >&2
    exit 1
  fi

  printf '%s\n' "$now" > "$stamp"
  chmod 600 "$stamp" 2>/dev/null
fi

[ "$validate_only" -eq 1 ] && exit 0
[ "$1" = "--" ] && shift
[ "$#" -eq 0 ] && set -- /bin/sh
exec su -c "$*" root
`;
}

const HELP_SCRIPT = `help() {
  cat <<'EOF'
No Root Access sandbox help
---------------------------
This shell uses BusyBox-style Linux commands. Many commands support:

  <command> --help
  command -v <command>
  busybox

Common commands:
  Files:       ls cat pwd cd mkdir rmdir touch cp mv rm chmod chown find
  Text:        echo printf grep sed awk head tail sort uniq wc cut tr
  Processes:   ps kill jobs bg fg sleep time
  System:      whoami id uname hostname date env export which type
  Archives:    tar gzip gunzip
  Network:     ping wget nc netstat ip route ifconfig
  Shell:       alias unalias history source . set unset test

Notes:
  man pages are not installed in this tiny sandbox image.
  Try "man <command>" for a compact fallback, or "<command> --help".
EOF
}
`;

function manScript() {
  return `#!/bin/sh
if [ "$#" -eq 0 ]; then
  echo "Usage: man <command>"
  echo "This sandbox has no full man page database. Try: man ls"
  exit 0
fi

cmd="$1"
if command -v "$cmd" >/dev/null 2>&1; then
  "$cmd" --help 2>&1 | head -80
  exit 0
fi

if busybox "$cmd" --help >/dev/null 2>&1; then
  busybox "$cmd" --help 2>&1 | head -80
  exit 0
fi

echo "No manual entry for $cmd"
exit 1
`;
}

export function buildRootSetup(scene) {
  const { user } = scene;
  const commands = [
    `hostname ${shellQuote(scene.hostname)} >/dev/null 2>&1`,
    "mkdir -p /home /root",
  ];

  if (user.name !== "root") {
    commands.push(
      `adduser -D -u ${user.uid} -h ${shellQuote(user.home)} -s /bin/sh ${shellQuote(user.name)} >/dev/null 2>&1 || true`,
      `mkdir -p ${shellQuote(user.home)}`,
    );
  }

  commands.push(`mkdir -p ${shellQuote(scene.cwd)}`);

  const directories = scene.files
    .filter((entry) => entry.type === "directory")
    .sort((left, right) => left.path.length - right.path.length);
  const files = scene.files.filter((entry) => entry.type === "file");

  for (const entry of [...directories, ...files]) {
    if (entry.type === "directory") {
      commands.push(`mkdir -p ${shellQuote(entry.path)}`);
    } else {
      commands.push(
        `mkdir -p ${shellQuote(parentDirectory(entry.path))}`,
        `printf '%s' ${shellQuote(entry.content)} > ${shellQuote(entry.path)}`,
      );
    }

    commands.push(
      `chmod ${entry.mode} ${shellQuote(entry.path)} >/dev/null 2>&1`,
      `chown ${shellQuote(`${entry.owner}:${entry.group}`)} ${shellQuote(entry.path)} >/dev/null 2>&1 || true`,
    );
  }

  commands.push(
    `printf '%s' ${shellQuote(sudoScript(user.password))} > /usr/bin/sudo`,
    "chmod 755 /usr/bin/sudo",
    `printf '%s' ${shellQuote(manScript())} > /usr/bin/man`,
    "chmod 755 /usr/bin/man",
    "passwd -d root >/dev/null 2>&1 || true",
  );

  if (user.name !== "root") {
    commands.push(
      `chown -R ${shellQuote(`${user.name}:${user.name}`)} ${shellQuote(user.home)} >/dev/null 2>&1 || true`,
      `exec su ${shellQuote(user.name)} -s /bin/sh`,
    );
  }

  return `${commands.join("; ")}\n`;
}

export function buildShellSetup(scene, columns, rows, marker) {
  const accent = PROMPT_ACCENTS[scene.accent] ?? PROMPT_ACCENTS.cyan;
  const prompt = `\\[\\033[1;38;5;${accent}m\\]\\u\\[\\033[38;5;244m\\]@\\[\\033[38;5;114m\\]\\h\\[\\033[0m\\]:\\[\\033[38;5;75m\\]\\w\\[\\033[0m\\]\\$ `;
  const commands = [
    `export HOME=${shellQuote(scene.user.home)}`,
    `export USER=${shellQuote(scene.user.name)}`,
    `export LOGNAME=${shellQuote(scene.user.name)}`,
    HELP_SCRIPT.trim(),
  ];

  for (const [key, value] of Object.entries(scene.env)) {
    commands.push(`export ${key}=${shellQuote(value)}`);
  }

  commands.push(
    `cd ${shellQuote(scene.cwd)} 2>/dev/null || cd ${shellQuote(scene.user.home)}`,
    `export PS1=${shellQuote(prompt)}`,
    `stty cols ${Math.max(20, columns)} rows ${Math.max(8, rows)} 2>/dev/null || true`,
    `printf '\n%s\n' ${shellQuote(marker)}`,
  );

  return `${commands.join("; ")}\n`;
}
