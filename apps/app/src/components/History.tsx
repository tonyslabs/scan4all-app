import { useState } from 'react';
import { kindLabel } from '../lib/entity';
import { clearHistory, loadHistory, removeHistory } from '../lib/history';
import type { Target } from '../types';
import VerdictChip from './Chip';
import Page from './Page';

export default function History({ onOpen }: { onOpen: (target: Target) => void }) {
  const [items, setItems] = useState(loadHistory);
  return <Page title="Historial">
    {items.length === 0 ? <p className="empty">Aún no hay nada aquí. Lo que analices o consultes aparecerá en este historial, guardado solo en este dispositivo.</p> : <>
      <ul className="rows">
        {items.map(item => <li key={`${item.kind}:${item.id}`} className="row-wrap">
          <button type="button" className="row" data-v={item.verdict} onClick={() => onOpen({ kind: item.kind, id: item.id, label: item.label })}>
            <span className="row-kind">{kindLabel[item.kind]}</span>
            <span className="row-main">{item.label}</span>
            <span className="row-time">{new Date(item.time).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <VerdictChip kind={item.verdict} />
          </button>
          <button type="button" className="btn row-del" aria-label={`Quitar ${item.label} del historial`}
            onClick={() => { removeHistory(item.kind, item.id); setItems(loadHistory()); }}>✕</button>
        </li>)}
      </ul>
      <button className="btn" type="button" onClick={() => { clearHistory(); setItems([]); }}>Borrar historial</button>
    </>}
  </Page>;
}
