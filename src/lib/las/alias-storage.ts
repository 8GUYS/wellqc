import fs from "fs";
import path from "path";
import { CustomAliasEntry } from "./standardiser";

const DATA_DIR = path.join(process.cwd(), "data");
const ALIASES_FILE = path.join(DATA_DIR, "custom-aliases.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readCustomAliasesFromFile(): CustomAliasEntry[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(ALIASES_FILE)) {
      fs.writeFileSync(ALIASES_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(ALIASES_FILE, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.warn("Failed to read custom aliases file:", error);
    return [];
  }
}

export function writeCustomAliasesToFile(aliases: CustomAliasEntry[]): boolean {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write custom aliases file:", error);
    return false;
  }
}
