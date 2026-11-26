"use client";

import { MockHttpError, mockRequest } from "./mock-api";
import { normalizeRemote, prepareRemoteBody, prepareRemotePath, toBackendId } from "./remote";

const BASE = "/api/v1";
const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "auto";
let currentActor = "a-hr";
let actorFromSession = false;
let transport: "remote" | "mock" | undefined;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "api_error") { super(message); }
}
export function setApiActor(id: string, verified = actorFromSession) { currentActor = id; actorFromSession = verified; }
export function getApiActor() { return currentActor; }
export function getApiMode() { return transport ?? API_MODE; }

async function rawRemote(path: string, init: RequestInit = {}, actorId = currentActor) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const fullPath = path.startsWith(BASE) ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(prepareRemotePath(fullPath), "http://remote.local");
  if (!actorFromSession) url.searchParams.set("actor_id", toBackendId(actorId));
  return fetch(`${url.pathname}${url.search}`, { ...init, headers, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(30000) });
}
async function errorFromResponse(response: Response) {
  let message = `Ошибка Go API · ${response.status}`; let code = "api_error";
  try {
    const payload = await response.json() as { error?: { message?: string; code?: string } | string; message?: string };
    if (typeof payload.error === "string") message = payload.error;
    else if (payload.error?.message) message = payload.error.message;
    else if (payload.message) message = payload.message;
    if (typeof payload.error === "object" && payload.error.code) code = payload.error.code;
  } catch { /* backend может вернуть не JSON */ }
  return new ApiError(response.status, message, code);
}

export async function surveyFileRequest(path: string, init: RequestInit = {}) {
  if (getApiMode() === "mock") throw new ApiError(0, "Импорт и выгрузка доступны при подключении к серверу Пульса", "mock_mode");
  let response: Response;
  try {
    response = await rawRemote(path, init);
  } catch {
    throw new ApiError(0, "Не удалось подключиться к API для работы с файлами", "network_error");
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

async function local<T>(path: string, actorId: string, init: RequestInit): Promise<T> {
  try { return await mockRequest<T>(path, actorId, init); }
  catch (error) { if (error instanceof MockHttpError) throw new ApiError(error.status, error.message); throw error; }
}

async function remote<T>(path: string, init: RequestInit, actorId: string): Promise<T> {
  const remoteInit = { ...init };
  if (init.body) remoteInit.body = JSON.stringify(prepareRemoteBody(JSON.parse(String(init.body))));
  let response: Response;
  try { response = await rawRemote(path, remoteInit, actorId); }
  catch { throw new ApiError(0, "Не удалось связаться с сервером Пульса", "network_error"); }
  if (!response.ok) throw await errorFromResponse(response);
  const payload = await response.json() as unknown;
  return normalizeRemote<T>(path, payload);
}

async function request<T>(actorId: string, path: string, init: RequestInit): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (getApiMode() === "mock") return local<T>(url, actorId, init);
  if (API_MODE !== "auto" || transport || url !== `${BASE}/actors` || init.method) return remote<T>(url, init, actorId);

  // Keep the source chosen when loading the profile for all reads and writes in this session.
  try {
    const result = await remote<T>(url, init, actorId);
    transport = "remote";
    return result;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 0 && error.status < 500)) throw error;
    const result = await local<T>(url, actorId, init);
    transport = "mock";
    return result;
  }
}

export const api = <T,>(path: string, init: RequestInit = {}) => request<T>(currentActor, path, init);
export const getAs = <T,>(actorId: string, path: string) => request<T>(actorId, path, {});
export const postAs = <T,>(actorId: string, path: string, body: unknown) => request<T>(actorId, path, { method: "POST", body: JSON.stringify(body) });

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
