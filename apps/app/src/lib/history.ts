import type { Kind } from '../types';
import type { VerdictKind } from './verdict';

export interface HistoryItem { kind: Kind; id: string; label: string; verdict: VerdictKind; time: number }
const KEY = 'scan4all.history';
const MAX = 200;

export function loadHistory(): HistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(i => i && typeof i.id === 'string' && typeof i.kind === 'string') : [];
  } catch { return []; }
}
function save(items: HistoryItem[]) { try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); } catch { /* sin almacenamiento */ } }
export function addHistory(item: Omit<HistoryItem, 'time'>) {
  const rest = loadHistory().filter(i => !(i.kind === item.kind && i.id === item.id));
  save([{ ...item, time: Date.now() }, ...rest]);
}
export function removeHistory(kind: Kind, id: string) { save(loadHistory().filter(i => !(i.kind === kind && i.id === id))); }
export function clearHistory() { try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } }
