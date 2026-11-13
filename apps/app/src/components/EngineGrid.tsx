import { categoryLabel } from '../lib/verdict';
import type { Engine } from '../lib/verdict';

/** Todos los motores a la vista: detecciones primero y resaltadas; los que no pudieron opinar, atenuados. */
export default function EngineGrid({ engines, label }: { engines: Engine[]; label: string }) {
  return <ul className="egrid" aria-label={label}>
    {engines.map(e => {
      const hit = e.category === 'malicious' || e.category === 'suspicious';
      const generic = !hit && ['clean', 'unrated'].includes(e.result ?? '');  // repite lo que ya dice el veredicto
      const off = !hit && e.category !== 'undetected' && e.category !== 'harmless';
      return <li key={e.name} className={`eng${hit ? ` hit ${e.category}` : ''}${off ? ' off' : ''}`}>
        <span className="eng-name">{e.name}</span>
        <span className="eng-cat">{e.category === 'malicious' ? '◆ ' : e.category === 'suspicious' ? '△ ' : ''}{categoryLabel[e.category] ?? e.category}</span>
        {e.result && !generic && <span className="eng-sig">{e.result}</span>}
      </li>;
    })}
  </ul>;
}
