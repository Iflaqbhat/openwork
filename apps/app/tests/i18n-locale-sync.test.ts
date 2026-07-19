import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  LANGUAGE_PREF_KEY,
  currentLocale,
  initLocale,
  refreshLocaleFromStorage,
  setLocale,
  subscribeLocale,
} from "../src/i18n";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function delayedReadableStorage(): Storage & { makeReadable: () => void } {
  const storage = memoryStorage();
  let readable = false;
  return {
    ...storage,
    getItem(key: string) {
      if (!readable) return null;
      return storage.getItem(key);
    },
    makeReadable() {
      readable = true;
    },
  };
}

function installBrowserGlobals(storage: Storage) {
  const attrs = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        setAttribute(name: string, value: string) {
          attrs.set(name, value);
        },
      },
    },
  });
  return attrs;
}

describe("i18n locale storage sync", () => {
  beforeEach(() => {
    installBrowserGlobals(memoryStorage());
    setLocale("en");
  });

  afterEach(() => {
    setLocale("en");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });

  test("refreshes locale when stored language becomes readable after startup", () => {
    const storage = delayedReadableStorage();
    storage.setItem(LANGUAGE_PREF_KEY, "zh");
    const attrs = installBrowserGlobals(storage);

    expect(initLocale()).toBe("en");
    expect(currentLocale()).toBe("en");
    expect(attrs.get("lang")).toBe("en");

    let notifications = 0;
    const unsubscribe = subscribeLocale(() => {
      notifications += 1;
    });

    storage.makeReadable();

    expect(refreshLocaleFromStorage()).toBe("zh");
    expect(currentLocale()).toBe("zh");
    expect(attrs.get("lang")).toBe("zh");
    expect(notifications).toBe(1);

    unsubscribe();
  });

  test("ignores empty delayed storage reads after a locale has been applied", () => {
    const storage = memoryStorage();
    const attrs = installBrowserGlobals(storage);

    setLocale("ja");
    expect(refreshLocaleFromStorage()).toBe("ja");
    expect(currentLocale()).toBe("ja");
    expect(attrs.get("lang")).toBe("ja");
  });
});
