import type { Analysis, AnalysisStats, EngineResult } from '../types';

export type VerdictKind = 'threat' | 'suspicious' | 'clean' | 'unknown';
export interface Engine extends EngineResult { name: string }
export const categoryLabel: Record<string, string> = {
  malicious: 'Malicioso', suspicious: 'Sospechoso', undetected: 'Sin detección',
  harmless: 'Inofensivo', 'type-unsupported': 'Tipo no soportado',
  timeout: 'Tiempo agotado', 'confirmed-timeout': 'Tiempo agotado', failure: 'Error',
};
export function classify(analysis: Analysis): VerdictKind {
  return classifyStats(analysis.data.attributes.stats);
}
export function classifyStats(s: AnalysisStats | undefined): VerdictKind {
  if (!s || s.harmless + s.malicious + s.suspicious + s.undetected === 0) return 'unknown';
  if (s.malicious > 0) return 'threat';
  if (s.suspicious > 0) return 'suspicious';
  return 'clean';
}
export function sortedEngines(analysis: Analysis): Engine[] {
  return enginesFrom(analysis.data.attributes.results);
}
export function enginesFrom(results: Record<string, EngineResult> | undefined): Engine[] {
  const rank = (category: string) => category === 'malicious' ? 0 : category === 'suspicious' ? 1
    : category === 'undetected' || category === 'harmless' ? 2 : 3;
  return Object.entries(results ?? {}).map(([name, info]) => ({ ...info, name }))
    .sort((a, b) => rank(a.category) - rank(b.category));
}
