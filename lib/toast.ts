/**
 * Leichtgewichtiges, dependency-freies Toast-System. Funktioniert aus jeder
 * Client-Komponente (auch aus async-Callbacks) via Window-Event – kein
 * Context-Plumbing nötig. Gerendert vom <Toaster /> im Cockpit-Layout.
 */
export type ToastTone = "success" | "error" | "info";

export interface ToastPayload {
  id: number;
  tone: ToastTone;
  message: string;
}

export const TOAST_EVENT = "rsg:toast";

function emit(tone: ToastTone, message: string) {
  if (typeof window === "undefined" || !message) return;
  const detail: ToastPayload = { id: Date.now() + Math.random(), tone, message };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};
