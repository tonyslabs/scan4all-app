export type ScanSubmission =
  | { kind: "file"; file: File; name: string; mime: string }
  | { kind: "url"; url: string; name: string; mime: string };

export interface ScanResponse {
  ok: true;
  vt: { data: { id: string } };
}

export interface AnalysisStats {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  "type-unsupported"?: number;
  timeout?: number;
  failure?: number;
}

export interface EngineResult {
  category: string;
  result: string | null;
}

export interface Analysis {
  meta?: {
    file_info?: { sha256?: string };
    url_info?: { id?: string };
  };
  data: {
    attributes: {
      status: string;
      date?: number;
      stats?: AnalysisStats;
      results?: Record<string, EngineResult>;
    };
  };
}

// ───── Consulta (archivos, URLs, dominios, IPs) ─────
export type Kind = "file" | "url" | "domain" | "ip";

/** Objeto del servicio de análisis. `attributes` es abierto a propósito: cambia según el tipo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attrs = Record<string, any>;
export interface Entity { id: string; type: string; attributes: Attrs }
export interface EntityPage { data: Entity[]; meta?: { cursor?: string; count?: number } }
export interface Target { kind: Kind; id: string; label?: string }
