import { useEffect, useState } from "react";

export interface Holding {
  symbol: string;
  quantity: number;
  buyPrice: number;
}

export interface UserSettings {
  budgetMax: number | null;
  holdings: Holding[];
}

const STORAGE_KEY = "user-settings-v1";
// When bumping STORAGE_KEY, add a migration branch in read() that reads the
// previous key, transforms it, writes to the new key, then clears the old one.
const EVENT = "user-settings-changed";

const defaults: UserSettings = { budgetMax: null, holdings: [] };

function read(): UserSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      budgetMax: typeof parsed.budgetMax === "number" ? parsed.budgetMax : null,
      holdings: Array.isArray(parsed.holdings)
        ? parsed.holdings.filter(
            (h: any): h is Holding =>
              typeof h?.symbol === "string" &&
              typeof h?.quantity === "number" &&
              typeof h?.buyPrice === "number",
          )
        : [],
    };
  } catch {
    return defaults;
  }
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => read());

  useEffect(() => {
    const handler = () => setSettings(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const save = (next: UserSettings) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  };

  return { settings, save };
}