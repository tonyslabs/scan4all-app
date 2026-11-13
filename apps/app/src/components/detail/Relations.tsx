import { useEffect, useState } from 'react';
import { relationships } from '../../api';
import { fmtDate } from '../../lib/format';
import { kindLabel, kindOf, targetOf, titleOf, verdictOf } from '../../lib/entity';
import { shortId } from '../../lib/format';
import type { Entity, Kind, Target } from '../../types';
import VerdictChip from '../Chip';
import Spinner from '../Spinner';

export const relationLabels: Record<string, string> = {
  contacted_domains: 'Dominios contactados', contacted_ips: 'IPs contactadas', contacted_urls: 'URLs contactadas',
  dropped_files: 'Archivos que genera', execution_parents: 'Quién lo ejecuta', bundled_files: 'Archivos incluidos',
  compressed_parents: 'Contenido en', itw_urls: 'URLs donde circula', itw_domains: 'Dominios donde circula', itw_ips: 'IPs donde circula',
  similar_files: 'Archivos similares', downloaded_files: 'Archivos descargados', last_serving_ip_address: 'Última IP que lo sirvió',
  redirecting_urls: 'URLs que redirigen aquí', redirects_to: 'Redirige a', referrer_files: 'Archivos que lo referencian',
  communicating_files: 'Archivos que se comunican', resolutions: 'Resoluciones', subdomains: 'Subdominios', siblings: 'Dominios hermanos',
  urls: 'URLs', historical_ssl_certificates: 'Certificados históricos',
};
export const relationsByKind: Record<Kind, string[]> = {
  file: ['contacted_domains', 'contacted_ips', 'contacted_urls', 'dropped_files', 'execution_parents', 'bundled_files', 'compressed_parents', 'itw_urls', 'itw_domains', 'itw_ips', 'similar_files'],
  url: ['contacted_domains', 'contacted_ips', 'downloaded_files', 'last_serving_ip_address', 'redirecting_urls', 'redirects_to', 'referrer_files', 'communicating_files'],
  domain: ['resolutions', 'subdomains', 'siblings', 'urls', 'communicating_files', 'downloaded_files', 'referrer_files', 'historical_ssl_certificates'],
  ip: ['resolutions', 'urls', 'communicating_files', 'downloaded_files', 'referrer_files', 'historical_ssl_certificates'],
};

function describe(kind: Kind, e: Entity): { title: string; sub?: string; target: Target | null } {
  const a = e.attributes ?? {};
  const k = kindOf(e.type);
  if (k) {
    const sub = k === 'file' ? a.type_description : k === 'ip' ? [a.country, a.as_owner].filter(Boolean).join(' · ') : undefined;
    return { title: shortOr(titleOf(k, e)), sub, target: targetOf(e) };
  }
  if (e.type === 'resolution') {
    const toIp = kind === 'domain';
    const value: string | undefined = toIp ? a.ip_address : a.host_name;
    return { title: value ?? e.id, sub: fmtDate(a.date),
      target: value ? { kind: toIp ? 'ip' : 'domain', id: value, label: value } : null };
  }
  return { title: a.subject?.CN ?? shortId(e.id, 16, 8), sub: [a.issuer?.O, a.validity?.not_after].filter(Boolean).join(' · ') || undefined, target: null };
}
const shortOr = (s: string) => s.length > 120 ? `${s.slice(0, 117)}…` : s;

export default function Relations({ kind, id, onOpen }: { kind: Kind; id: string; onOpen: (t: Target) => void }) {
  const options = relationsByKind[kind];
  const [rel, setRel] = useState(options[0]);
  const [items, setItems] = useState<Entity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    relationships(kind, id, rel, more ? cursor : undefined, controller.signal).then(page => {
      setItems(previous => more ? [...previous, ...page.data] : page.data);
      setCursor(page.meta?.cursor);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // `cursor` se lee solo al pedir más; no debe relanzar la consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, rel, more]);

  return <div className="rel">
    <label className="sr" htmlFor="rel">Relación</label>
    <select id="rel" className="select" value={rel} onChange={event => { setItems([]); setCursor(undefined); setMore(0); setRel(event.currentTarget.value); }}>
      {options.map(o => <option key={o} value={o}>{relationLabels[o] ?? o}</option>)}
    </select>
    {error && <p className="empty" role="alert">{error}</p>}
    {!loading && !error && !items.length && <p className="empty">Sin elementos.</p>}
    <ul className="rows">
      {items.map(entity => {
        const d = describe(kind, entity); const k = kindOf(entity.type);
        const body = <>
          <span className="row-kind">{k ? kindLabel[k] : entity.type === 'resolution' ? 'Resolución' : 'Certificado'}</span>
          <span className="row-main">{d.title}{d.sub && <small>{d.sub}</small>}</span>
          {k && entity.attributes?.last_analysis_stats && <VerdictChip kind={verdictOf(entity)} />}
        </>;
        return <li key={`${entity.type}:${entity.id}`}>{d.target
          ? <button type="button" className="row" data-v={k && entity.attributes?.last_analysis_stats ? verdictOf(entity) : undefined} onClick={() => onOpen(d.target!)}>{body}</button>
          : <div className="row static">{body}</div>}</li>;
      })}
    </ul>
    {loading && <div className="center"><Spinner /></div>}
    {!loading && cursor && <button className="btn" type="button" onClick={() => setMore(n => n + 1)}>Cargar más</button>}
  </div>;
}
