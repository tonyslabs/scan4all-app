import type { Attrs, Entity, Kind, Target } from '../types';
import type { Engine, VerdictKind } from './verdict';
import { classifyStats, enginesFrom } from './verdict';

export const kindLabel: Record<Kind, string> = { file: 'Archivo', url: 'URL', domain: 'Dominio', ip: 'IP' };

/** Id de una URL: base64url sin relleno de sus bytes UTF-8. */
export function urlId(url: string): string {
  const bytes = new TextEncoder().encode(url);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const HASH = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^(?=.*:.*:)[0-9a-f:.]{2,45}$/i;
const DOMAIN = /^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/i;

/** Reconoce qué es lo que escribió la persona. `null` = búsqueda libre. */
export function detect(input: string): Target | null {
  const value = input.trim();
  if (!value) return null;
  if (HASH.test(value)) return { kind: 'file', id: value.toLowerCase(), label: value.toLowerCase() };
  if (IPV4.test(value) || IPV6.test(value)) return { kind: 'ip', id: value, label: value };
  if (/^https?:\/\//i.test(value) && value.length <= 2048) {
    try { if (new URL(value).hostname) return { kind: 'url', id: urlId(value), label: value }; } catch { /* no es URL */ }
    return null;
  }
  if (DOMAIN.test(value)) return { kind: 'domain', id: value.toLowerCase(), label: value.toLowerCase() };
  return null;
}

/** Tipo del objeto en la respuesta → tipo de la app (los que no se pueden abrir devuelven null). */
export function kindOf(type: string): Kind | null {
  return type === 'file' ? 'file' : type === 'url' ? 'url' : type === 'domain' ? 'domain'
    : type === 'ip_address' ? 'ip' : null;
}

export function titleOf(kind: Kind, entity: Entity, fallback?: string): string {
  const a: Attrs = entity.attributes ?? {};
  if (kind === 'file') return a.meaningful_name || a.names?.[0] || fallback || entity.id;
  if (kind === 'url') return a.url || a.last_final_url || fallback || entity.id;
  return fallback || entity.id;
}

export function targetOf(entity: Entity): Target | null {
  const kind = kindOf(entity.type);
  return kind ? { kind, id: entity.id, label: titleOf(kind, entity) } : null;
}

export function verdictOf(entity: Entity): VerdictKind {
  return classifyStats(entity.attributes?.last_analysis_stats);
}

export function enginesOf(entity: Entity): Engine[] {
  return enginesFrom(entity.attributes?.last_analysis_results);
}
