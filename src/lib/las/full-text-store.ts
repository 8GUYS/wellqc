/**
 * IndexedDB storage helper for complete raw LAS text.
 * Keeps full un-downsampled file content in the browser for full-resolution cleaning.
 * Never throws an exception on missing or blocked storage.
 */

const DB_NAME = "wellqc_full_las";
const DB_VERSION = 1;
const STORE_NAME = "las_text";
const RECORD_KEY = "active_upload";

export interface StoredFullLasText {
  fileName: string;
  fullText: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves the active upload file name and full raw LAS text to IndexedDB.
 * Fails silently if IndexedDB is unavailable or blocked.
 */
export async function saveFullLasText(fileName: string, fullText: string): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ fileName, fullText }, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Fail silently; never throw
  } finally {
    try {
      db?.close();
    } catch {
      // Fail silently
    }
  }
}

/**
 * Loads the active upload file name and full raw LAS text from IndexedDB.
 * Returns null if no record is found or if storage cannot be accessed.
 */
export async function loadFullLasText(): Promise<StoredFullLasText | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    return await new Promise<StoredFullLasText | null>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // Fail silently
    }
  }
}

/**
 * Clears the stored active upload raw text from IndexedDB.
 * Fails silently if storage cannot be accessed.
 */
export async function clearFullLasText(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Fail silently; never throw
  } finally {
    try {
      db?.close();
    } catch {
      // Fail silently
    }
  }
}
