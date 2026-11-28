const { config } = require("../config");
const { readStorageConfig, writeStorageConfig, publicStorageConfig } = require("./storage-config");
const { SqliteStore } = require("./sqlite-store");
const { SupabaseStore } = require("./supabase-store");

let storePromise = null;
let activeStore = null;

function createAdapter(storage) {
  if (storage.mode === "supabase") return new SupabaseStore(storage.supabase);
  return new SqliteStore(config.localDbPath);
}

async function getStore() {
  const storage = readStorageConfig();
  if (!storage) return null;
  if (!storePromise) {
    storePromise = createAdapter(storage)
      .init()
      .then((store) => {
        activeStore = store;
        return store;
      })
      .catch((error) => {
        storePromise = null;
        throw error;
      });
  }
  return storePromise;
}

async function configureStorage(input) {
  if (readStorageConfig()) {
    const error = new Error("存储方式已经锁定，不能再次更改");
    error.code = "STORAGE_LOCKED";
    throw error;
  }
  const store = createAdapter(input);
  try {
    await store.init();
    await store.ping();
    const saved = writeStorageConfig(input);
    activeStore = store;
    storePromise = Promise.resolve(store);
    return { storage: publicStorageConfig(saved), store };
  } catch (error) {
    await store.close();
    throw error;
  }
}

async function getLocalStatus() {
  const storage = readStorageConfig();
  if (!storage) {
    return {
      storageConfigured: false,
      storageMode: null,
      storage: null,
      classExists: false,
      className: null,
      storageError: null
    };
  }
  try {
    const store = await getStore();
    const cls = await store.getClass();
    return {
      storageConfigured: true,
      storageMode: storage.mode,
      storage: publicStorageConfig(storage),
      classExists: !!cls,
      className: cls ? cls.name : null,
      storageError: null
    };
  } catch (error) {
    return {
      storageConfigured: true,
      storageMode: storage.mode,
      storage: publicStorageConfig(storage),
      classExists: false,
      className: null,
      storageError: String((error && error.message) || error)
    };
  }
}

async function closeLocalStore() {
  const store = activeStore;
  activeStore = null;
  storePromise = null;
  if (store) await store.close();
}

module.exports = { getStore, getLocalStatus, configureStorage, closeLocalStore };
