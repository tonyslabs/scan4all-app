import type { Attrs, Kind } from '../../types';
import { fmtBytes, fmtDate } from '../../lib/format';
import { DataTable, Rows, Section } from './Rows';

export default function Overview({ kind, attrs, voting, voted, onVote }: {
  kind: Kind; attrs: Attrs; voting: boolean; voted: string; onVote: (verdict: 'harmless' | 'malicious') => void;
}) {
  const stats = attrs.last_analysis_stats ?? {};
  const unsupported = stats['type-unsupported'] ?? 0;
  const votes = attrs.total_votes ?? {};
  const tags: string[] = Array.isArray(attrs.tags) ? attrs.tags : [];
  const categories = attrs.categories && typeof attrs.categories === 'object'
    ? Array.from(new Set(Object.values(attrs.categories).map(String))) : [];
  const threat = attrs.popular_threat_classification;
  const rows: [string, React.ReactNode][] = kind === 'file' ? [
    ['Tipo', attrs.type_description], ['Tamaño', fmtBytes(attrs.size)],
    ['Amenaza', threat?.suggested_threat_label], ['Primer envío', fmtDate(attrs.first_submission_date)],
    ['Último análisis', fmtDate(attrs.last_analysis_date)], ['Veces enviado', attrs.times_submitted],
  ] : kind === 'url' ? [
    ['Título', attrs.title], ['Respuesta HTTP', attrs.last_http_response_code], ['Primer envío', fmtDate(attrs.first_submission_date)],
    ['Último análisis', fmtDate(attrs.last_analysis_date)], ['Veces enviada', attrs.times_submitted],
  ] : kind === 'domain' ? [
    ['Registrador', attrs.registrar], ['Creado', fmtDate(attrs.creation_date, false)],
    ['Último análisis', fmtDate(attrs.last_analysis_date)], ['Reputación', attrs.reputation],
  ] : [
    ['Propietario', attrs.as_owner], ['País', attrs.country], ['Red', attrs.network],
    ['Último análisis', fmtDate(attrs.last_analysis_date)], ['Reputación', attrs.reputation],
  ];
  const dns: Attrs[] = Array.isArray(attrs.last_dns_records) ? attrs.last_dns_records : [];
  const ofType = (t: string) => dns.filter(r => r.type === t).map(r => String(r.value ?? '')).filter(Boolean);
  const cert = attrs.last_https_certificate;
  const facts: [string, string | undefined][] = kind === 'domain' ? [
    ['Registrador', attrs.registrar], ['Creado', attrs.creation_date ? fmtDate(attrs.creation_date, false) : undefined],
    ['Dirección IP', [...ofType('A'), ...ofType('AAAA')].slice(0, 3).join(' · ') || undefined],
    ['Correo (MX)', ofType('MX')[0], ], ['Servidores DNS', ofType('NS').length ? `${ofType('NS').length} · ${ofType('NS')[0]}` : undefined],
    ['Certificado', cert ? [cert.issuer?.O ?? cert.issuer?.CN, cert.validity?.not_after && `hasta ${cert.validity.not_after.slice(0, 10)}`].filter(Boolean).join(' · ') : undefined],
    ['Reputación', attrs.reputation !== undefined ? String(attrs.reputation) : undefined],
  ] : kind === 'ip' ? [
    ['Propietario', attrs.as_owner], ['País', attrs.country], ['ASN', attrs.asn ? String(attrs.asn) : undefined],
    ['Red', attrs.network], ['Registro regional', attrs.regional_internet_registry],
    ['Reputación', attrs.reputation !== undefined ? String(attrs.reputation) : undefined],
  ] : [];
  const shownFacts = facts.filter((f): f is [string, string] => Boolean(f[1]));
  return <>
    <ul className="result-chips" aria-label="Resumen por categoría">
      <li>◆ {stats.malicious ?? 0} maliciosos</li><li>△ {stats.suspicious ?? 0} sospechosos</li>
      <li>{(stats.undetected ?? 0) + (stats.harmless ?? 0)} sin detección</li>
      {unsupported > 0 && <li>{unsupported} tipo no soportado</li>}
    </ul>
    {shownFacts.length > 0 && <div className="facts">{shownFacts.map(([k, v]) => <div className="fact" key={k}><span>{k}</span><b>{v}</b></div>)}</div>}
    {kind !== 'domain' && kind !== 'ip' && <Rows rows={rows} />}
    {kind === 'domain' && dns.length > 0 && <Section title="Registros DNS"><DataTable head={['Tipo', 'Valor', 'TTL']}
      rows={dns.slice(0, 12).map(r => [<span className="dns-type">{r.type}</span>, String(r.value ?? r.rname ?? ''), r.ttl])} /></Section>}
    {tags.length > 0 && <Section title="Etiquetas"><ul className="tags">{tags.map(t => <li key={t}>{t}</li>)}</ul></Section>}
    {categories.length > 0 && <Section title="Categorías"><ul className="tags">{categories.map(t => <li key={t}>{t}</li>)}</ul></Section>}
    <Section title="Comunidad">
      <p className="sub">{votes.harmless ?? 0} votos de inofensivo · {votes.malicious ?? 0} votos de malicioso</p>
      <div className="vote-act">
        <button className="btn" type="button" disabled={voting || Boolean(voted)} onClick={() => onVote('harmless')}>Votar inofensivo</button>
        <button className="btn" type="button" disabled={voting || Boolean(voted)} onClick={() => onVote('malicious')}>Votar malicioso</button>
      </div>
      {voted && <p className="hint" role="status">Voto registrado.</p>}
    </Section>
  </>;
}
