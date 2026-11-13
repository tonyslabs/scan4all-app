import type { ReactNode } from 'react';
import type { Attrs, Kind } from '../../types';
import { fmtBytes, fmtDate } from '../../lib/format';
import { Code, DataTable, Pre, Row, Rows, Section } from './Rows';

const list = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
const lines = (items: string[]): ReactNode => items.length ? <ul className="plain">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : undefined;
const cert = (c: Attrs | undefined): Row[] => c ? [
  ['Sujeto', c.subject?.CN], ['Emisor', c.issuer?.O ?? c.issuer?.CN],
  ['Válido desde', c.validity?.not_before], ['Válido hasta', c.validity?.not_after],
  ['Huella SHA-256', c.thumbprint_sha256 && <Code>{c.thumbprint_sha256}</Code>],
] : [];
const labelOf: Record<string, string> = { product: 'Producto', description: 'Descripción', copyright: 'Derechos', 'original name': 'Nombre original',
  'file version': 'Versión', signers: 'Firmantes', verified: 'Verificación', 'internal name': 'Nombre interno', 'signing date': 'Fecha de firma' };

function FileDetails({ a }: { a: Attrs }) {
  const sig: Attrs = a.signature_info ?? {};
  const pe: Attrs = a.pe_info ?? {};
  const yara: Attrs[] = Array.isArray(a.crowdsourced_yara_results) ? a.crowdsourced_yara_results : [];
  const ids: Attrs[] = Array.isArray(a.crowdsourced_ids_results) ? a.crowdsourced_ids_results : [];
  const sandboxes = a.sandbox_verdicts && typeof a.sandbox_verdicts === 'object' ? Object.values(a.sandbox_verdicts) as Attrs[] : [];
  return <>
    <Section title="Archivo"><Rows rows={[
      ['Nombres', lines(list(a.names).slice(0, 8))], ['Tipo', a.type_description], ['Formato', a.type_tag], ['Magic', a.magic],
      ['Tamaño', fmtBytes(a.size)], ['MD5', a.md5 && <Code>{a.md5}</Code>], ['SHA-1', a.sha1 && <Code>{a.sha1}</Code>],
      ['SHA-256', a.sha256 && <Code>{a.sha256}</Code>], ['SSDEEP', a.ssdeep && <Code>{a.ssdeep}</Code>],
      ['TLSH', a.tlsh && <Code>{a.tlsh}</Code>], ['VHash', a.vhash && <Code>{a.vhash}</Code>],
      ['Primer envío', fmtDate(a.first_submission_date)], ['Último envío', fmtDate(a.last_submission_date)],
      ['Última modificación', fmtDate(a.last_modification_date)], ['Veces enviado', a.times_submitted], ['Reputación', a.reputation],
    ]} /></Section>
    {Object.keys(sig).length > 0 && <Section title="Firma digital"><Rows rows={Object.entries(sig).map(([k, v]) => [labelOf[k] ?? k, typeof v === 'string' ? v : undefined] as Row)} /></Section>}
    {Object.keys(pe).length > 0 && <Section title="Ejecutable (PE)">
      <Rows rows={[['Imphash', pe.imphash && <Code>{pe.imphash}</Code>], ['Arquitectura', pe.machine_type], ['Compilado', fmtDate(pe.timestamp)], ['Punto de entrada', pe.entry_point]]} />
      <DataTable head={['Sección', 'Tamaño virtual', 'Tamaño en disco', 'Entropía']}
        rows={(Array.isArray(pe.sections) ? pe.sections : []).map((s: Attrs) => [s.name, s.virtual_size, s.raw_size, typeof s.entropy === 'number' ? s.entropy.toFixed(2) : '—'])} />
    </Section>}
    {yara.length > 0 && <Section title="Reglas YARA"><DataTable head={['Regla', 'Conjunto', 'Fuente']} rows={yara.map(y => [y.rule_name, y.ruleset_name, y.source])} /></Section>}
    {ids.length > 0 && <Section title="Reglas de red (IDS)"><DataTable head={['Alerta', 'Severidad', 'Fuente']} rows={ids.map(r => [r.rule_msg, r.alert_severity, r.rule_source])} /></Section>}
    {sandboxes.length > 0 && <Section title="Veredictos de sandbox"><DataTable head={['Sandbox', 'Categoría', 'Clasificación']}
      rows={sandboxes.map(s => [s.sandbox_name, s.category, list(s.malware_classification).join(', ') || '—'])} /></Section>}
  </>;
}
function UrlDetails({ a }: { a: Attrs }) {
  const trackers = a.trackers && typeof a.trackers === 'object' ? Object.keys(a.trackers) : [];
  const headers = a.last_http_response_headers && typeof a.last_http_response_headers === 'object' ? Object.entries(a.last_http_response_headers) : [];
  return <>
    <Section title="URL"><Rows rows={[
      ['URL', a.url && <Code>{a.url}</Code>], ['URL final', a.last_final_url && <Code>{a.last_final_url}</Code>], ['Título', a.title],
      ['Respuesta HTTP', a.last_http_response_code], ['Tamaño de respuesta', fmtBytes(a.last_http_response_content_length)],
      ['SHA-256 de respuesta', a.last_http_response_content_sha256 && <Code>{a.last_http_response_content_sha256}</Code>],
      ['Cadena de redirecciones', lines(list(a.redirection_chain))], ['Rastreadores', lines(trackers)],
      ['Primer envío', fmtDate(a.first_submission_date)], ['Último análisis', fmtDate(a.last_analysis_date)],
      ['Veces enviada', a.times_submitted], ['Reputación', a.reputation],
    ]} /></Section>
    {list(a.outgoing_links).length > 0 && <Section title="Enlaces salientes">{lines(list(a.outgoing_links).slice(0, 30))}</Section>}
    {headers.length > 0 && <Section title="Cabeceras de respuesta"><DataTable head={['Cabecera', 'Valor']} rows={headers.map(([k, v]) => [k, String(v)])} /></Section>}
  </>;
}
function NetDetails({ kind, a }: { kind: Kind; a: Attrs }) {
  const dns: Attrs[] = Array.isArray(a.last_dns_records) ? a.last_dns_records : [];
  const ranks = a.popularity_ranks && typeof a.popularity_ranks === 'object' ? Object.entries(a.popularity_ranks) as [string, Attrs][] : [];
  return <>
    <Section title={kind === 'domain' ? 'Dominio' : 'Dirección IP'}><Rows rows={kind === 'domain' ? [
      ['Registrador', a.registrar], ['Creado', fmtDate(a.creation_date, false)], ['Última actualización', fmtDate(a.last_update_date, false)],
      ['TLD', a.tld], ['Reputación', a.reputation], ['JARM', a.jarm && <Code>{a.jarm}</Code>],
    ] : [
      ['Propietario', a.as_owner], ['ASN', a.asn], ['País', a.country], ['Continente', a.continent], ['Red', a.network],
      ['Registro regional', a.regional_internet_registry], ['Reputación', a.reputation], ['JARM', a.jarm && <Code>{a.jarm}</Code>],
      ['Última modificación', fmtDate(a.last_modification_date)],
    ]} /></Section>
    {dns.length > 0 && <Section title="Registros DNS"><DataTable head={['Tipo', 'Valor', 'TTL']} rows={dns.map(r => [<span className="dns-type">{r.type}</span>, r.value ?? `${r.rname ?? ''} ${r.priority ?? ''}`.trim(), r.ttl])} /></Section>}
    {ranks.length > 0 && <Section title="Popularidad"><DataTable head={['Lista', 'Posición']} rows={ranks.map(([k, v]) => [k, v?.rank])} /></Section>}
    {a.last_https_certificate && <Section title="Certificado HTTPS"><Rows rows={cert(a.last_https_certificate)} /></Section>}
    {typeof a.whois === 'string' && a.whois && <Section title="Whois"><Pre>{a.whois}</Pre></Section>}
  </>;
}
export default function Details({ kind, attrs }: { kind: Kind; attrs: Attrs }) {
  return kind === 'file' ? <FileDetails a={attrs} /> : kind === 'url' ? <UrlDetails a={attrs} /> : <NetDetails kind={kind} a={attrs} />;
}
