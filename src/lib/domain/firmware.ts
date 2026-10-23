/**
 * Where ESP32 firmware should POST readings, derived from the backend API base URL
 * (NOT from window.location — the console and the backend often run on different hosts).
 * One function for display AND copy, so the shown URL is always the copied one.
 */
export function firmwarePostUrl(apiBase: string): string {
  try {
    // A relative base ("/api", proxy mode) resolves against this page's origin.
    const url = new URL(apiBase, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    // url.host omits default ports, so https stays https://host/… (old code forced :80).
    return `${url.protocol}//${url.host}/api/readings`;
  } catch {
    return `${apiBase.replace(/\/+$/, "")}/readings`;
  }
}

/** Copy-ready sample payload for firmware developers. */
export function samplePayload(deviceId: string, machineName: string | null) {
  return {
    device_id: deviceId,
    machine_name: machineName || "MACHINE_NAME",
    voltage_v: 230,
    current_amps: 12.5,
    power_kw: 2.6,
    power_factor: 0.9,
    frequency_hz: 50,
    temperature_c: 62.5,
    vibration_mm_s: 1.8,
    load_factor_pct: 75,
  };
}

/** Clipboard write that never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
