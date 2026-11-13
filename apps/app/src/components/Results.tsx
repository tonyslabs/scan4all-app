import { useState } from 'react';
import type { Engine } from '../lib/verdict';
import type { Analysis } from '../types';
import EngineGrid from './EngineGrid';

export default function Results({ analysis, engines, lastQuery, identifier, identifierLabel }: {
  analysis: Analysis; engines: Engine[]; lastQuery: number | null; identifier?: string; identifierLabel: string;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const stats = analysis.data.attributes.stats;
  const unsupported = stats?.['type-unsupported'] ?? engines.filter(e => e.category === 'type-unsupported').length;
  const date = analysis.data.attributes.date;
  const time = typeof date === 'number' && Number.isFinite(date) ? date * 1000 : lastQuery;
  async function copy() {
    if (!identifier) return;
    try { await navigator.clipboard.writeText(identifier); setCopyStatus('Copiado.'); }
    catch { setCopyStatus('No se pudo copiar. Selecciona el identificador para copiarlo.'); }
  }
  return <div className="results">
    <p className="result-source">{engines.length} motores · {time !== null ? new Date(time).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : 'fecha no disponible'}</p>
    {identifier && <div className="result-id"><span>{identifierLabel}</span> <code title={identifier}>{identifier.slice(0, 12)}…{identifier.slice(-8)}</code>
      <button className="btn" type="button" aria-label={`Copiar ${identifierLabel}`} onClick={() => void copy()}>Copiar</button>
      <span role="status">{copyStatus}</span><details><summary>Ver identificador completo</summary><code className="full-id">{identifier}</code></details>
    </div>}
    <ul className="result-chips" aria-label="Resumen por categoría">
      <li>◆ {stats?.malicious ?? 0} maliciosos</li><li>△ {stats?.suspicious ?? 0} sospechosos</li>
      <li>{(stats?.undetected ?? 0) + (stats?.harmless ?? 0)} sin detección</li>
      {unsupported > 0 && <li>{unsupported} tipo no soportado</li>}
    </ul>
    <h2 className="engines-title">Motores <span>{engines.length}</span></h2>
    {engines.length ? <EngineGrid engines={engines} label="Resultado de cada motor" /> : <p className="empty">No hay resultados de motores disponibles.</p>}
  </div>;
}
