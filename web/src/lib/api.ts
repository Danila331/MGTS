"use client";

import { MockHttpError, mockRequest } from "./mock-api";
import { normalizeRemote, prepareRemoteBody, prepareRemotePath, toBackendId } from "./remote";

const BASE = "/api/v1";
const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "auto";
let currentActor = "a-hr";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "api_error") { super(message); }
}
export function setApiActor(id: string) { currentActor = id; }
export function getApiActor() { return currentActor; }
export function getApiMode() { return API_MODE; }

async function rawRemote(path: string, init: RequestInit = {}, actorId = currentActor) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const fullPath = path.startsWith(BASE) ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(prepareRemotePath(fullPath), "http://remote.local");
  url.searchParams.set("actor_id", toBackendId(actorId));
  return fetch(`${url.pathname}${url.search}`, { ...init, headers, cache: "no-store" });
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
  if (API_MODE === "mock") throw new ApiError(0, "Импорт и выгрузка доступны в режиме Go API", "mock_mode");
  let response: Response;
  try {
    response = await rawRemote(path, init);
  } catch {
    throw new ApiError(0, "Не удалось подключиться к API для работы с файлами", "network_error");
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

async function remote<T>(path: string, init: RequestInit, actorId: string, allowMock: boolean): Promise<T> {
  const remoteInit = { ...init };
  if (init.body) remoteInit.body = JSON.stringify(prepareRemoteBody(path, JSON.parse(String(init.body)), actorId));
  let response: Response;
  try { response = await rawRemote(path, remoteInit, actorId); }
  catch {
    if (allowMock) {
      try { return await mockRequest<T>(path, actorId, init); }
      catch (mockError) { if (mockError instanceof MockHttpError) throw new ApiError(mockError.status, mockError.message); throw mockError; }
    }
    throw new ApiError(0, "Go API недоступен. Проверьте http://127.0.0.1:8080/api/v1", "network_error");
  }
  if (!response.ok) {
    if (allowMock && response.status >= 500) {
      try { return await mockRequest<T>(path, actorId, init); }
      catch (mockError) { if (mockError instanceof MockHttpError) throw new ApiError(mockError.status, mockError.message); throw mockError; }
    }
    throw await errorFromResponse(response);
  }
  const payload = await response.json() as unknown;
  return normalizeRemote<T>(path, payload, async (referencePath) => {
    const reference = await rawRemote(referencePath, {}, actorId);
    if (!reference.ok) throw await errorFromResponse(reference);
    return reference.json() as unknown;
  });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (API_MODE === "mock") {
    try { return await mockRequest<T>(url, currentActor, init); }
    catch (error) { if (error instanceof MockHttpError) throw new ApiError(error.status, error.message); throw error; }
  }
  return remote<T>(url, init, currentActor, API_MODE === "auto");
}

export const getAs = <T,>(actorId: string, path: string) => remote<T>(path, {}, actorId, false);
export const postAs = <T,>(actorId: string, path: string, body: unknown) => remote<T>(path, { method: "POST", body: JSON.stringify(body) }, actorId, false);

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
