import type { ReactNode } from 'react';

export type Row = [string, ReactNode];
const empty = (v: ReactNode) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length);

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="dsec"><h2>{title}</h2>{children}</section>;
}
export function Rows({ rows }: { rows: Row[] }) {
  const shown = rows.filter(([, v]) => !empty(v));
  if (!shown.length) return null;
  return <dl className="kv">{shown.map(([k, v]) => <div className="kv-row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
/** La columna con más texto absorbe el ancho y se parte; las demás no se parten (así "Tipo" nunca se rompe letra por letra). */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return null;
  const size = (c: ReactNode) => (typeof c === 'string' || typeof c === 'number' ? String(c).length : 0);
  const widths = head.map((_, i) => rows.reduce((max, r) => Math.max(max, size(r[i])), head[i].length));
  const wide = widths.indexOf(Math.max(...widths));
  const cls = (i: number) => (i === wide ? 'wide' : 'fit');
  return <div className="dtable" tabIndex={0}><table>
    <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={cls(i)}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cls(j)}>{c}</td>)}</tr>)}</tbody>
  </table></div>;
}
export function Code({ children }: { children: ReactNode }) { return <code className="mono">{children}</code>; }
export function Pre({ children }: { children: ReactNode }) { return <pre className="whois">{children}</pre>; }
