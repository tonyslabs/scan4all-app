import type { VerdictKind } from '../lib/verdict';

const text: Record<VerdictKind, string> = { threat: '◆ Malicioso', suspicious: '△ Sospechoso', clean: 'Limpio', unknown: 'Sin análisis' };
export default function VerdictChip({ kind }: { kind: VerdictKind }) {
  return <span className={`vchip v-${kind}`}>{text[kind]}</span>;
}
