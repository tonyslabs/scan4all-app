import { useRef, useState } from 'react';
import { search } from '../api';
import { detect, kindLabel, kindOf, targetOf, titleOf, verdictOf } from '../lib/entity';
import type { Entity, Target } from '../types';
import VerdictChip from './Chip';
import Page from './Page';
import Spinner from './Spinner';

export default function Search({ onOpen }: { onOpen: (target: Target) => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Entity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  async function run(more = false) {
    const value = query.trim();
    if (!value) return;
    const direct = detect(value);
    if (direct && !more) { onOpen(direct); return; }
    abort.current?.abort();
    const controller = abort.current = new AbortController();
    setLoading(true); setError('');
    try {
      const page = await search(value, more ? cursor : undefined, controller.signal);
      if (controller.signal.aborted) return;
      const visible = page.data.filter(e => kindOf(e.type));
      setItems(previous => more ? [...previous, ...visible] : visible);
      setCursor(page.meta?.cursor); setSearched(true);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo buscar.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <Page title="Buscar">
    <form className="search-form" noValidate onSubmit={event => { event.preventDefault(); void run(); }}>
      <label className="sr" htmlFor="q">Buscar</label>
      <input id="q" value={query} onChange={event => setQuery(event.currentTarget.value)} autoFocus
        placeholder="Hash, dominio, IP, URL o una consulta" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button className="btn pri" type="submit" disabled={loading || !query.trim()}>Buscar</button>
    </form>
    <p className="hint">Un hash (MD5, SHA-1 o SHA-256), un dominio, una IP o una URL abre su informe. Cualquier otro texto se busca.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {searched && !loading && !items.length && !error && <p className="empty">Sin resultados.</p>}
    <ul className="rows">
      {items.map(entity => {
        const target = targetOf(entity); const kind = kindOf(entity.type)!;
        if (!target) return null;
        return <li key={`${entity.type}:${entity.id}`}><button type="button" className="row" data-v={verdictOf(entity)} onClick={() => onOpen(target)}>
          <span className="row-kind">{kindLabel[kind]}</span>
          <span className="row-main">{titleOf(kind, entity)}</span>
          <VerdictChip kind={verdictOf(entity)} />
        </button></li>;
      })}
    </ul>
    {loading && <div className="center"><Spinner /></div>}
    {!loading && cursor && items.length > 0 && <button className="btn" type="button" onClick={() => void run(true)}>Cargar más</button>}
  </Page>;
}
