import { createHttpApi, type VideApi } from "./endpoints";
import { createMockApi } from "./mock";

export type { ApiResult } from "./client";
export type { DevicePatch, MachineProfilePatch, VideApi } from "./endpoints";

/** Real HTTP client for `baseUrl`, or the in-memory mock fleet. */
export function createApi(baseUrl: string, useMocks: boolean): VideApi {
  return useMocks ? createMockApi() : createHttpApi(baseUrl);
}
