const TTS_DB_NAME = "deutschkarte_tts_cache_v1";
const TTS_STORE_NAME = "clips";
const TTS_DB_VERSION = 1;
const MAX_TTS_DB_ENTRIES = 600;
const MAX_TTS_DB_BYTES = 100 * 1024 * 1024;

let dbPromise = null;

function openTtsDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(TTS_DB_NAME, TTS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TTS_STORE_NAME)) {
          const store = db.createObjectStore(TTS_STORE_NAME, { keyPath: "key" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

function toExactArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function getCachedTtsAudio(key) {
  if (!key) {
    return null;
  }
  const db = await openTtsDb();
  if (!db) {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TTS_STORE_NAME, "readonly");
      const store = tx.objectStore(TTS_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const rec = req.result;
        if (!rec || !rec.bytes) {
          resolve(null);
          return;
        }
        resolve({
          bytes: new Uint8Array(rec.bytes),
          sampleRate: Number(rec.sampleRate) || 24000,
          mimeType: String(rec.mimeType || "audio/L16;rate=24000")
        });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function pruneTtsCacheIfNeeded(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TTS_STORE_NAME, "readwrite");
      const store = tx.objectStore(TTS_STORE_NAME);
      const index = store.index("updatedAt");
      const records = [];
      let totalBytes = 0;

      const cursorReq = index.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const val = cursor.value;
          const sizeBytes = Number(val?.sizeBytes) || 0;
          totalBytes += sizeBytes;
          records.push({ key: val.key, sizeBytes });
          cursor.continue();
          return;
        }

        let remainingCount = records.length;
        for (const item of records) {
          if (
            remainingCount <= MAX_TTS_DB_ENTRIES &&
            totalBytes <= MAX_TTS_DB_BYTES
          ) {
            break;
          }
          store.delete(item.key);
          remainingCount -= 1;
          totalBytes -= item.sizeBytes;
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putCachedTtsAudio(
  key,
  { bytes, sampleRate = 24000, mimeType = "audio/L16;rate=24000" } = {}
) {
  if (!key || !bytes || !bytes.byteLength) {
    return;
  }
  const db = await openTtsDb();
  if (!db) {
    return;
  }
  const buffer = toExactArrayBuffer(bytes);
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(TTS_STORE_NAME, "readwrite");
      const store = tx.objectStore(TTS_STORE_NAME);
      store.put({
        key,
        bytes: buffer,
        sampleRate: Number(sampleRate) || 24000,
        mimeType: String(mimeType || "audio/L16;rate=24000"),
        sizeBytes: buffer.byteLength,
        updatedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  await pruneTtsCacheIfNeeded(db);
}

export async function getTtsCacheStats() {
  const db = await openTtsDb();
  if (!db) {
    return { count: 0, totalBytes: 0 };
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TTS_STORE_NAME, "readonly");
      const store = tx.objectStore(TTS_STORE_NAME);
      let count = 0;
      let totalBytes = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          count += 1;
          totalBytes += Number(cursor.value?.sizeBytes) || 0;
          cursor.continue();
        } else {
          resolve({ count, totalBytes });
        }
      };
      req.onerror = () => resolve({ count: 0, totalBytes: 0 });
    } catch {
      resolve({ count: 0, totalBytes: 0 });
    }
  });
}

export async function clearTtsCache() {
  const db = await openTtsDb();
  if (!db) {
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TTS_STORE_NAME, "readwrite");
      tx.objectStore(TTS_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
