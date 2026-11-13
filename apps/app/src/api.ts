import { API_TOKEN, getApiUrl } from "./config";
import type { Analysis, Attrs, Entity, EntityPage, Kind, ScanResponse } from "./types";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", API_TOKEN);
  const response = await fetch(`${getApiUrl().replace(/\/$/, "")}${path}`, { ...init, headers });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (init.signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.detail === "string"
      ? body.detail
      : `La solicitud falló (HTTP ${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return body;
}

function submission(body: unknown): ScanResponse {
  if (!isRecord(body) || body.ok !== true || !isRecord(body.vt) ||
      !isRecord(body.vt.data) || typeof body.vt.data.id !== "string" || !body.vt.data.id) {
    throw new ApiError(502, "La API no devolvió un identificador de análisis válido.");
  }
  return { ok: true, vt: { data: { id: body.vt.data.id } } };
}

export async function scanFile(file: File, signal?: AbortSignal): Promise<ScanResponse> {
// Desarrollo: VITE_MOCK=threat pnpm --filter @scan4all/app dev (también clean o unknown).
  if (import.meta.env.DEV && ["threat", "clean", "unknown"].includes(import.meta.env.VITE_MOCK)) return (await import("./lib/mockScan")).submitMock("file", signal);
  const body = new FormData();
  body.append("file", file);
  return submission(await request("/scan/upload", { method: "POST", body, signal }));
}

export async function scanUrl(url: string, signal?: AbortSignal): Promise<ScanResponse> {
  if (import.meta.env.DEV && ["threat", "clean", "unknown"].includes(import.meta.env.VITE_MOCK)) return (await import("./lib/mockScan")).submitMock("url", signal);
  return submission(await request("/scan/url", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }), signal,
  }));
}

export async function getStatus(id: string, signal?: AbortSignal): Promise<Analysis> {
  if (import.meta.env.DEV && ["threat", "clean", "unknown"].includes(import.meta.env.VITE_MOCK)) return (await import("./lib/mockScan")).statusMock(id, signal);
  const body = await request(`/scan/status/${encodeURIComponent(id)}`, { signal });
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.attributes) ||
      typeof body.data.attributes.status !== "string") {
    throw new ApiError(502, "La API devolvió un estado de análisis inválido.");
  }
  const attributes = body.data.attributes;
  const stats = attributes.stats;
  if (stats !== undefined && (!isRecord(stats) ||
      !["harmless", "malicious", "suspicious", "undetected"].every(
        key => typeof stats[key] === "number" && Number.isFinite(stats[key]) && stats[key] >= 0,
      ))) {
    throw new ApiError(502, "La API devolvió estadísticas inválidas.");
  }
  const results = attributes.results;
  if (results !== undefined && (!isRecord(results) || !Object.values(results).every(
    entry => isRecord(entry) && typeof entry.category === "string" &&
      (entry.result === null || typeof entry.result === "string"),
  ))) {
    throw new ApiError(502, "La API devolvió resultados de motores inválidos.");
  }
  return body as unknown as Analysis;
}

// ───── Consulta: informes, relaciones, comentarios, votos y búsqueda ─────
const enc = encodeURIComponent;
const base = (kind: Kind, id: string) => `/lookup/${kind}/${enc(id)}`;

function entityBody(body: unknown): Entity {
  if (!isRecord(body) || !isRecord(body.data) || typeof body.data.id !== "string" || !isRecord(body.data.attributes)) {
    throw new ApiError(502, "La API devolvió una respuesta inválida.");
  }
  return body.data as unknown as Entity;
}
function pageBody(body: unknown): EntityPage {
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiError(502, "La API devolvió una respuesta inválida.");
  return body as unknown as EntityPage;
}
function pageQuery(limit: number, cursor?: string) {
  return `limit=${limit}${cursor ? `&cursor=${enc(cursor)}` : ""}`;
}
const json = (payload: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
});

export async function lookup(kind: Kind, id: string, signal?: AbortSignal): Promise<Entity> {
  return entityBody(await request(base(kind, id), { signal }));
}
export async function rescan(kind: Kind, id: string, signal?: AbortSignal): Promise<string> {
  return submission(await request(`${base(kind, id)}/rescan`, { method: "POST", signal })).vt.data.id;
}
export async function relationships(kind: Kind, id: string, rel: string, cursor?: string, signal?: AbortSignal): Promise<EntityPage> {
  return pageBody(await request(`${base(kind, id)}/relationships/${enc(rel)}?${pageQuery(10, cursor)}`, { signal }));
}
/** El resumen de comportamiento no trae `id`/`attributes`: `data` es el resumen en sí. */
export async function behaviour(id: string, signal?: AbortSignal): Promise<Attrs> {
  const body = await request(`${base("file", id)}/behaviour`, { signal });
  if (!isRecord(body) || !isRecord(body.data)) throw new ApiError(502, "La API devolvió una respuesta inválida.");
  return body.data as Attrs;
}
export async function comments(kind: Kind, id: string, cursor?: string, signal?: AbortSignal): Promise<EntityPage> {
  return pageBody(await request(`${base(kind, id)}/comments?${pageQuery(10, cursor)}`, { signal }));
}
export async function addComment(kind: Kind, id: string, text: string, signal?: AbortSignal): Promise<Entity> {
  return entityBody(await request(`${base(kind, id)}/comments`, json({ text }, signal)));
}
export async function addVote(kind: Kind, id: string, verdict: "harmless" | "malicious", signal?: AbortSignal): Promise<void> {
  await request(`${base(kind, id)}/votes`, json({ verdict }, signal));
}
export async function search(query: string, cursor?: string, signal?: AbortSignal): Promise<EntityPage> {
  return pageBody(await request(`/search?q=${enc(query)}&${pageQuery(20, cursor)}`, { signal }));
}

/** Espera a que un análisis termine. Tolera "demasiadas consultas" (429) esperando más. */
export async function waitAnalysis(id: string, signal: AbortSignal, onTick?: () => void): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 4000);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Cancelado", "AbortError")); }, { once: true });
    });
    try {
      if ((await getStatus(id, signal)).data.attributes.status === "completed") return;
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 429)) throw cause;
    }
    onTick?.();
  }
  throw new ApiError(504, "El análisis tardó demasiado.");
}
