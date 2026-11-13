import { useEffect, useState } from 'react';
import { addComment, comments } from '../../api';
import { fmtDate } from '../../lib/format';
import type { Entity, Kind } from '../../types';
import Spinner from '../Spinner';

export default function Comments({ kind, id }: { kind: Kind; id: string }) {
  const [items, setItems] = useState<Entity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(0);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    comments(kind, id, more ? cursor : undefined, controller.signal).then(page => {
      setItems(previous => more ? [...previous, ...page.data] : page.data);
      setCursor(page.meta?.cursor);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, more]);

  async function post() {
    const value = text.trim();
    if (!value || posting) return;
    setPosting(true); setPostError('');
    try { const created = await addComment(kind, id, value); setItems(previous => [created, ...previous]); setText(''); }
    catch (cause) { setPostError(cause instanceof Error ? cause.message : 'No se pudo publicar.'); }
    finally { setPosting(false); }
  }
  return <div className="comments">
    <form className="comment-form" onSubmit={event => { event.preventDefault(); void post(); }}>
      <label className="sr" htmlFor="comment">Escribe un comentario</label>
      <textarea id="comment" value={text} maxLength={2000} rows={3} placeholder="Escribe un comentario. Puedes usar #etiquetas." onChange={event => setText(event.currentTarget.value)} />
      <div className="comment-act">
        <span className="hint">Los comentarios son públicos.</span>
        <button className="btn pri" type="submit" disabled={posting || !text.trim()}>{posting ? <Spinner size="sm" label="Publicando" /> : 'Publicar'}</button>
      </div>
      {postError && <p className="error" role="alert">{postError}</p>}
    </form>
    {error && <p className="empty" role="alert">{error}</p>}
    {!loading && !error && !items.length && <p className="empty">Todavía no hay comentarios.</p>}
    <ul className="rows">
      {items.map(c => <li key={c.id} className="comment">
        <p className="comment-meta">{fmtDate(c.attributes.date)} · 👍 {c.attributes.votes?.positive ?? 0} · 👎 {c.attributes.votes?.negative ?? 0}</p>
        <p className="comment-text">{c.attributes.text}</p>
      </li>)}
    </ul>
    {loading && <div className="center"><Spinner /></div>}
    {!loading && cursor && <button className="btn" type="button" onClick={() => setMore(n => n + 1)}>Cargar más</button>}
  </div>;
}
