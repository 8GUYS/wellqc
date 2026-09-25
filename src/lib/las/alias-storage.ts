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

export function readAllCustomAliasesFromFile(): CustomAliasEntry[] {
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

/**
 * Filter custom aliases strictly to the specified user/account.
 * Backward compatibility: unassigned legacy entries are matched by addedBy to preserve existing data.
 */
export function readCustomAliasesForUser(
  user?: { id?: string; email?: string; name?: string } | null
): CustomAliasEntry[] {
  const all = readAllCustomAliasesFromFile();

  if (!user || (!user.id && !user.email)) {
    // Demo or unauthenticated context
    return all.filter(
      (e) => !e.userId || e.userId === "demo-petrophysicist-uuid"
    );
  }

  const userId = user.id?.trim();
  const userEmail = user.email?.trim().toLowerCase();
  const userName = user.name?.trim().toLowerCase();

  return all.filter((entry) => {
    // 1. Explicit userId match
    if (entry.userId) {
      return entry.userId === userId;
    }
    // 2. Explicit email match
    if (entry.userEmail && userEmail) {
      return entry.userEmail.toLowerCase() === userEmail;
    }
    // 3. Fallback for unassigned legacy entries: match by addedBy author name
    if (entry.addedBy && userName) {
      return entry.addedBy.toLowerCase() === userName;
    }
    return false;
  });
}

/**
 * Alias helper for backward-compatibility with existing calls:
 * If a userId or filter string is passed, filters by user; otherwise returns all.
 */
export function readCustomAliasesFromFile(userId?: string): CustomAliasEntry[] {
  if (userId) {
    return readCustomAliasesForUser({ id: userId });
  }
  return readAllCustomAliasesFromFile();
}

/**
 * Saves a new custom alias strictly bound to the user's account.
 */
export function saveUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  newEntry: CustomAliasEntry
): CustomAliasEntry[] {
  const all = readAllCustomAliasesFromFile();
  const userId = user?.id || "demo-petrophysicist-uuid";
  const userEmail = user?.email || "";

  const entryWithAccount: CustomAliasEntry = {
    ...newEntry,
    userId,
    userEmail,
  };

  const updatedAll = [...all, entryWithAccount];
  writeCustomAliasesToFile(updatedAll);

  return readCustomAliasesForUser(user);
}

/**
 * Updates a custom alias owned by the user's account.
 */
export function updateUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  oldAlias: string,
  newAlias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[]; entry?: CustomAliasEntry } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanOld = oldAlias.trim().toUpperCase();
  const cleanNew = newAlias.trim().toUpperCase();

  const userAliases = readCustomAliasesForUser(user);
  const targetInUser = userAliases.find(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanOld
  );

  if (!targetInUser) {
    return {
      success: false,
      error: `Alias "${oldAlias}" was not found under ${cleanMnem} for your account.`,
      aliases: userAliases,
    };
  }

  const index = all.findIndex((e) => e.id === targetInUser.id);
  if (index === -1) {
    return {
      success: false,
      error: "Alias not found.",
      aliases: userAliases,
    };
  }

  const updatedEntry: CustomAliasEntry = {
    ...all[index],
    alias: cleanNew,
    addedAt: new Date().toISOString(),
  };

  all[index] = updatedEntry;
  writeCustomAliasesToFile(all);

  return {
    success: true,
    entry: updatedEntry,
    aliases: readCustomAliasesForUser(user),
  };
}

/**
 * Deletes a custom alias owned by the user's account.
 */
export function deleteUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  alias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[] } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanAlias = alias.trim().toUpperCase();

  const userAliases = readCustomAliasesForUser(user);
  const targetInUser = userAliases.find(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanAlias
  );

  if (!targetInUser) {
    return {
      success: false,
      error: `Alias "${alias}" was not found under ${cleanMnem} for your account.`,
      aliases: userAliases,
    };
  }

  const updatedAll = all.filter((e) => e.id !== targetInUser.id);
  writeCustomAliasesToFile(updatedAll);

  return {
    success: true,
    aliases: readCustomAliasesForUser(user),
  };
}
