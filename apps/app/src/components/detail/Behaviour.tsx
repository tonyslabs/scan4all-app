import { useEffect, useState } from 'react';
import { behaviour } from '../../api';
import type { Attrs } from '../../types';
import Spinner from '../Spinner';

const labels: Record<string, string> = {
  tags: 'Etiquetas', calls_highlighted: 'Llamadas destacadas', files_written: 'Archivos escritos', files_deleted: 'Archivos borrados',
  files_opened: 'Archivos abiertos', files_dropped: 'Archivos generados', processes_created: 'Procesos creados', processes_terminated: 'Procesos terminados',
  command_executions: 'Comandos ejecutados', mutexes_created: 'Mutex creados', registry_keys_set: 'Claves de registro modificadas',
  registry_keys_deleted: 'Claves de registro borradas', dns_lookups: 'Consultas DNS', ip_traffic: 'Tráfico IP', http_conversations: 'Conversaciones HTTP',
  mitre_attack_techniques: 'Técnicas MITRE ATT&CK', modules_loaded: 'Módulos cargados', signature_matches: 'Firmas de comportamiento',
  verdicts: 'Veredictos', verdict_labels: 'Etiquetas de veredicto', services_started: 'Servicios iniciados', text_highlighted: 'Texto destacado',
};
function line(item: unknown): string {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return String(item);
  if (Array.isArray(item)) return item.map(line).join(', ');
  return Object.entries(item as Attrs).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${line(v)}`).join(' · ');
}
export default function Behaviour({ id }: { id: string }) {
  const [data, setData] = useState<Attrs | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    behaviour(id, controller.signal).then(setData).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
    });
    return () => controller.abort();
  }, [id]);
  if (error) return <p className="empty" role="alert">{error}</p>;
  if (!data) return <div className="center"><Spinner /></div>;
  const groups = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.length);
  if (!groups.length) return <p className="empty">No hay datos de comportamiento para este archivo.</p>;
  return <div className="behaviour">{groups.map(([key, value]) => <details key={key} className="bgroup" open={groups.length <= 3}>
    <summary>{labels[key] ?? key.replace(/_/g, ' ')} <span className="count">{(value as unknown[]).length}</span></summary>
    <ul className="plain">{(value as unknown[]).slice(0, 100).map((item, i) => <li key={i}>{line(item)}</li>)}</ul>
  </details>)}</div>;
}
