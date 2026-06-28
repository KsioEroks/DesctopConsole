const { app, BrowserWindow, ipcMain, shell, screen } = require("electron");
const path = require("path");
const fs = require("fs");

let programCache = null;
let deepProgramCache = null;

const positionFile = () => path.join(app.getPath("userData"), "window-position.json");

function loadWindowPosition() {
  try {
    const saved = JSON.parse(fs.readFileSync(positionFile(), "utf8"));

    if (typeof saved.x !== "number" || typeof saved.y !== "number") {
      return null;
    }

    const displays = screen.getAllDisplays();
    const isOnScreen = displays.some((display) => {
      const area = display.workArea;
      return (
        saved.x >= area.x - 300 &&
        saved.x <= area.x + area.width &&
        saved.y >= area.y - 200 &&
        saved.y <= area.y + area.height
      );
    });

    return isOnScreen ? saved : null;
  } catch {
    return null;
  }
}

function saveWindowPosition(win) {
  const position = win.getPosition();

  fs.writeFileSync(
    positionFile(),
    JSON.stringify(
      {
        x: position[0],
        y: position[1]
      },
      null,
      2
    )
  );
}

function getSearchRoots() {
  const roots = [];

  const add = (value) => {
    if (value && fs.existsSync(value) && !roots.includes(value)) {
      roots.push(value);
    }
  };

  add(path.join(process.env.ProgramData || "", "Microsoft", "Windows", "Start Menu", "Programs"));
  add(path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"));
  add(path.join(process.env.USERPROFILE || "", "Desktop"));
  add(path.join(process.env.PUBLIC || "C:\\Users\\Public", "Desktop"));
  add(process.env.ProgramFiles);
  add(process.env["ProgramFiles(x86)"]);
  add(path.join(process.env.LOCALAPPDATA || "", "Programs"));

  const pathDirs = (process.env.PATH || "").split(";");
  for (const dir of pathDirs) {
    add(dir);
  }

  return roots;
}

function getDriveRoots() {
  const roots = [];

  for (let code = 67; code <= 90; code += 1) {
    const drive = String.fromCharCode(code) + ":\\";
    if (fs.existsSync(drive)) {
      roots.push(drive);
    }
  }

  return roots;
}

function shouldSkipDir(dirPath) {
  const lower = dirPath.toLowerCase();

  return (
    lower.includes("\\windows\\winsxs") ||
    lower.includes("\\windows\\servicing") ||
    lower.includes("\\$recycle.bin") ||
    lower.includes("\\system volume information") ||
    lower.includes("\\node_modules") ||
    lower.includes("\\appdata\\local\\packages")
  );
}

function shouldSkipFile(fileName) {
  const lower = fileName.toLowerCase();

  return (
    lower.includes("uninstall") ||
    lower.includes("setup") ||
    lower.includes("installer") ||
    lower.includes("update") ||
    lower.includes("crash") ||
    lower.includes("helper")
  );
}

function walkPrograms(dir, depth = 0, maxDepth = 5, results = []) {
  if (depth > maxDepth || shouldSkipDir(dir)) return results;

  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkPrograms(fullPath, depth + 1, maxDepth, results);
      continue;
    }

    const lower = entry.name.toLowerCase();

    if ((lower.endsWith(".lnk") || lower.endsWith(".exe")) && !shouldSkipFile(entry.name)) {
      results.push({
        name: path.basename(entry.name, path.extname(entry.name)),
        path: fullPath
      });
    }
  }

  return results;
}

function getPrograms() {
  if (programCache) return programCache;

  const programs = [];

  for (const root of getSearchRoots()) {
    programs.push(...walkPrograms(root, 0, 5));
  }

  programCache = programs;
  return programCache;
}

function getDeepPrograms() {
  if (deepProgramCache) return deepProgramCache;

  const programs = [];

  for (const root of getDriveRoots()) {
    programs.push(...walkPrograms(root, 0, 7));
  }

  deepProgramCache = programs;
  return deepProgramCache;
}

function createWindow() {
  const savedPosition = loadWindowPosition();
  const win = new BrowserWindow({
    width: 560,
    height: 230,
    x: savedPosition ? savedPosition.x : 40,
    y: savedPosition ? savedPosition.y : 40,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile("index.html");
  let saveTimer = null;

win.on("move", () => {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveWindowPosition(win);
  }, 300);
});

win.on("close", () => {
  saveWindowPosition(win);
});
}

function translit(text) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
    ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ы: "y", э: "e", ю: "yu", я: "ya", ь: "", ъ: ""
  };

  return text
    .toLowerCase()
    .split("")
    .map((char) => map[char] || char)
    .join("");
}

function normalize(text) {
  return translit(text)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProgramName(command) {
  const stopWords = [
    "open", "start", "run", "launch",
    "otkryt", "otkroy", "zapusti", "zapuskay", "vklyuchi",
    "открыть", "открой", "запусти", "запускать", "включи",
    "пожалуйста", "please", "program", "programma"
  ];

  let words = command.toLowerCase().split(/\s+/);

  words = words.filter((word) => {
    const clean = normalize(word);
    return !stopWords.includes(word) && !stopWords.includes(clean);
  });

  const result = words.join(" ").trim();
  return result || command;
}

function getSearchRoots() {
  const roots = [];

  if (process.env.ProgramData) {
    roots.push(path.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs"));
  }

  if (process.env.APPDATA) {
    roots.push(path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs"));
  }

  if (process.env.ProgramFiles) {
    roots.push(process.env.ProgramFiles);
  }

  if (process.env["ProgramFiles(x86)"]) {
    roots.push(process.env["ProgramFiles(x86)"]);
  }

  if (process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, "Programs"));
  }

  return roots.filter((root) => fs.existsSync(root));
}

function walkPrograms(dir, depth = 0, maxDepth = 4, results = []) {
  if (depth > maxDepth) return results;

  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkPrograms(fullPath, depth + 1, maxDepth, results);
    } else {
      const lower = entry.name.toLowerCase();

      if (lower.endsWith(".lnk") || lower.endsWith(".exe")) {
        if (
          lower.includes("uninstall") ||
          lower.includes("setup") ||
          lower.includes("update") ||
          lower.includes("crash") ||
          lower.includes("helper")
        ) {
          continue;
        }

        results.push({
          name: path.basename(entry.name, path.extname(entry.name)),
          path: fullPath
        });
      }
    }
  }

  return results;
}

function getPrograms() {
  if (programCache) return programCache;

  const programs = [];

  for (const root of getSearchRoots()) {
    programs.push(...walkPrograms(root));
  }

  programCache = programs;
  return programCache;
}

function scoreProgram(query, programName) {
  const q = normalize(query);
  const name = normalize(programName);

  if (!q || !name) return 0;
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (q.includes(name)) return 50;

  const qParts = q.split(" ");
  let score = 0;

  for (const part of qParts) {
    if (part.length >= 3 && name.includes(part)) {
      score += 20;
    }
  }

  return score;
}

function findBestProgram(command, programs) {
  const wantedName = extractProgramName(command);

  let bestProgram = null;
  let bestScore = 0;

  for (const program of programs) {
    const score = scoreProgram(wantedName, program.name);

    if (score > bestScore) {
      bestScore = score;
      bestProgram = program;
    }
  }

  if (!bestProgram || bestScore < 40) {
    return null;
  }

  return bestProgram;
}

async function openProgramByCommand(command) {
  let bestProgram = findBestProgram(command, getPrograms());

  if (!bestProgram) {
    bestProgram = findBestProgram(command, getDeepPrograms());
  }

  if (!bestProgram) {
    return {
      ok: false,
      message: "Не распознано"
    };
  }

  const result = await shell.openPath(bestProgram.path);

  if (result) {
    return {
      ok: false,
      message: "Не удалось открыть"
    };
  }

  return {
    ok: true,
    name: bestProgram.name,
    path: bestProgram.path
  };
}

ipcMain.handle("open-program", async (event, command) => {
  return openProgramByCommand(command);
});

app.whenReady().then(() => {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath
  });

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
