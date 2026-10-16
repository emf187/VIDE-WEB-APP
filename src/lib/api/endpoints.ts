/**
 * EVERY backend call in the app lives in this file.
 *
 * Each function has an `API:` block:
 *   API:     method + path the UI calls (relative to the configured base URL, which ends in /api)
 *   Backend: what we know the FastAPI backend exposes today
 *   Returns: the normalised shape the UI gets
 *   TODO(backend): what needs to change on the server side
 *
 * When the backend changes, update the path / body here and the matching normaliser in
 * normalize.ts — pages should not need to change. The mock implementation in ./mock must
 * keep the same `VideApi` interface.
 */
import { LLM_TIMEOUT_MS } from "@/lib/constants";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CriticalEvent,
  Device,
  HealthInfo,
  Machine,
  MaintenanceRecord,
  Reading,
} from "@/lib/types";
import { mapResult, request, type ApiResult } from "./client";
import {
  toAnalyzeResponse,
  toChatAnswer,
  toCriticalEvents,
  toDevices,
  toHealthInfo,
  toMachines,
  toMaintenanceRecords,
  toReadings,
} from "./normalize";

export interface MachineProfilePatch {
  machine_type?: string;
  location?: string;
  rated_load_kw?: number;
}

export interface DevicePatch {
  device_type?: string;
  firmware?: string;
  ip?: string;
  notes?: string;
  linked_machine?: string | null;
}

export interface VideApi {
  health(): Promise<ApiResult<HealthInfo>>;
  listMachines(): Promise<ApiResult<Machine[]>>;
  createMachine(machine: { machine_name: string; machine_type?: string; location?: string; rated_load_kw?: number }): Promise<ApiResult<unknown>>;
  updateMachineProfile(name: string, patch: MachineProfilePatch): Promise<ApiResult<unknown>>;
  recentReadings(machine: string, limit: number): Promise<ApiResult<Reading[]>>;
  criticalEvents(limit: number): Promise<ApiResult<CriticalEvent[]>>;
  analyze(body: AnalyzeRequest): Promise<ApiResult<AnalyzeResponse>>;
  chat(message: string): Promise<ApiResult<string>>;
  maintenanceHistory(machine: string): Promise<ApiResult<MaintenanceRecord[]>>;
  addMaintenance(record: MaintenanceRecord & { machine_name: string }): Promise<ApiResult<unknown>>;
  listDevices(): Promise<ApiResult<Device[]>>;
  createDevice(deviceId: string): Promise<ApiResult<unknown>>;
  updateDevice(deviceId: string, patch: DevicePatch): Promise<ApiResult<unknown>>;
}

const enc = encodeURIComponent;

export function createHttpApi(baseUrl: string): VideApi {
  return {
    /**
     * API:     GET /health/detailed
     * Backend: exists.
     * Returns: { status, factoryName } — used by the global connection check (LIVE / OFFLINE badge).
     */
    async health() {
      return mapResult(await request(baseUrl, "/health/detailed"), toHealthInfo);
    },

    /**
     * API:     GET /machines
     * Backend: exists. Response includes health_status, stats, maintenance_prediction.
     * Returns: Machine[] (accepts a bare array or { machines: [...] }).
     */
    async listMachines() {
      return mapResult(await request(baseUrl, "/machines"), toMachines);
    },

    /**
     * API:     POST /machines  { machine_name, machine_type, location, rated_load_kw }
     * Backend: exists (the old HTML never called it — machines were only created locally).
     */
    async createMachine(machine) {
      return request(baseUrl, "/machines", { method: "POST", body: machine });
    },

    /**
     * API:     PATCH /machines/{name}  { machine_type, location, rated_load_kw }
     * Backend: DOES NOT EXIST YET — only GET/POST/DELETE in api/routes/machines.py.
     *          Until it exists this returns ok:false and the profile stays local-only.
     * TODO(backend): add PATCH /api/machines/{name}; also decide whether engineer contact
     *                fields (name/email/phone) move server-side.
     */
    async updateMachineProfile(name, patch) {
      return request(baseUrl, `/machines/${enc(name)}`, { method: "PATCH", body: patch });
    },

    /**
     * API:     GET /readings/recent/{machine_name}?limit=N
     * Backend: exists. The workhorse for tiles, graphs and predictions. Newest-first.
     * Guard:   the backend answers 404 when a machine has no readings yet — we treat that as [].
     * TODO(backend): return [] instead of 404 for "no readings".
     */
    async recentReadings(machine, limit) {
      const res = await request(baseUrl, `/readings/recent/${enc(machine)}?limit=${limit}`);
      if (!res.ok && res.status === 404) return { ok: true, data: [], status: 404, ms: res.ms };
      return mapResult(res, (data) => toReadings(data, machine));
    },

    /**
     * API:     GET /diagnostics/critical-events?limit=N
     * Backend: exists. Feeds the Overview ATTENTION QUEUE.
     * TODO(frontend): an "acknowledge" button → POST /diagnostics/critical-events/{id}/confirm (exists, no UI yet).
     */
    async criticalEvents(limit) {
      return mapResult(await request(baseUrl, `/diagnostics/critical-events?limit=${limit}`), toCriticalEvents);
    },

    /**
     * API:     POST /diagnostics/analyze  (AnalyzeRequest)
     *          use_llm:false + force_ml:true → EDGE (rules + ML, fast)
     *          use_llm:true                  → CLOUD (adds llm_analysis narrative)
     * Backend: exists. LLM is disabled by default (config.yaml llm.enabled:false, needs GROQ_API_KEY);
     *          then llm_analysis is empty and llm_error explains why.
     * TODO(backend): AnalyzeReadingInput may not declare temperature_c / vibration_mm_s /
     *                load_factor_pct, in which case Pydantic drops them. Verify in /docs.
     */
    async analyze(body) {
      const timeoutMs = body.use_llm ? LLM_TIMEOUT_MS : undefined;
      return mapResult(await request(baseUrl, "/diagnostics/analyze", { method: "POST", body, timeoutMs }), toAnalyzeResponse);
    },

    /**
     * API:     POST /diagnostics/chat  { message }
     * Backend: exists. The machine context is appended to `message` by the caller
     *          (the endpoint has no separate context field).
     * Returns: answer text (field name not confirmed — see toChatAnswer()).
     * TODO(backend): confirm the response field name (answer / response / reply).
     */
    async chat(message) {
      return mapResult(
        await request(baseUrl, "/diagnostics/chat", { method: "POST", body: { message }, timeoutMs: LLM_TIMEOUT_MS }),
        toChatAnswer,
      );
    },

    /**
     * API:     GET /maintenance/history/{machine_name}
     * Backend: exists (the old HTML guessed three wrong paths before falling back to local).
     * Guard:   404 → [] (no history yet).
     */
    async maintenanceHistory(machine) {
      const res = await request(baseUrl, `/maintenance/history/${enc(machine)}`);
      if (!res.ok && res.status === 404) return { ok: true, data: [], status: 404, ms: res.ms };
      return mapResult(res, toMaintenanceRecords);
    },

    /**
     * API:     POST /maintenance/record  { machine_name, date, type, technician, notes }
     * Backend: exists (old HTML posted to /maintenance, which does not).
     * TODO(backend): confirm body field names (e.g. maintenance_type vs type, performed_by vs technician).
     */
    async addMaintenance(record) {
      return request(baseUrl, "/maintenance/record", { method: "POST", body: record });
    },

    /**
     * API:     GET /devices
     * Backend: DOES NOT EXIST YET — the Devices registry is browser-local until it does.
     *          A failure here is expected and silently means "local registry only".
     * TODO(backend): add device CRUD (GET/POST /devices, PATCH /devices/{id}) with a linked_machine column.
     */
    async listDevices() {
      return mapResult(await request(baseUrl, "/devices"), toDevices);
    },

    /**
     * API:     POST /devices  { device_id }
     * Backend: DOES NOT EXIST YET (see listDevices).
     */
    async createDevice(deviceId) {
      return request(baseUrl, "/devices", { method: "POST", body: { device_id: deviceId } });
    },

    /**
     * API:     PATCH /devices/{device_id}  DevicePatch
     * Backend: DOES NOT EXIST YET (see listDevices).
     */
    async updateDevice(deviceId, patch) {
      return request(baseUrl, `/devices/${enc(deviceId)}`, { method: "PATCH", body: patch });
    },
  };
}
