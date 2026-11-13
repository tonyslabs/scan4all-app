import type { Analysis, ScanSubmission, Target } from '../types';
import { classify } from '../lib/verdict';
import { detect } from '../lib/entity';
import type { Engine } from '../lib/verdict';
import Results from './Results';
import { Sample } from './Wait';

export default function Verdict({ analysis, engines, submission, lastQuery, onReset, onDetails }: {
  analysis: Analysis; engines: Engine[]; submission: ScanSubmission; lastQuery: number | null; onReset: () => void;
  onDetails: (target: Target) => void;
}) {
  const kind = classify(analysis);
  const stats = analysis.data.attributes.stats;
  const rawId = submission.kind === 'file' ? analysis.meta?.file_info?.sha256 : analysis.meta?.url_info?.id;
  const identifier = typeof rawId === 'string' && rawId.length ? rawId : undefined;
  const target: Target | null = identifier ? { kind: submission.kind, id: identifier, label: submission.name } : null;
  const host = submission.kind === 'url' ? (() => { try { return detect(new URL(submission.url).hostname); } catch { return null; } })() : null;
  const title = kind === 'unknown' ? 'No se pudo analizar.' : kind === 'threat' ? 'Amenaza detectada.' : kind === 'suspicious' ? 'Elemento sospechoso.' : 'Sin detecciones.';
  return <section className="view v-verdict" aria-label="Veredicto">
    <div className="msg"><h1 tabIndex={-1}>{title}</h1>
      <p className="sub">{kind === 'unknown' ? 'No se pudo analizar este tipo de elemento.'
        : kind === 'clean' ? `Ninguno de los ${engines.length} motores lo marca. No es una garantía.`
          : `${stats?.malicious ?? 0} de ${engines.length} motores lo marcan como malicioso y ${stats?.suspicious ?? 0} como sospechoso.`}</p>
      <Sample submission={submission} />
    </div>
    <Results analysis={analysis} engines={engines} lastQuery={lastQuery} identifier={identifier} identifierLabel={submission.kind === 'file' ? 'SHA-256' : 'ID de URL'} />
    <div className="act">
      <button className="btn pri" type="button" onClick={onReset}>Analizar otro</button>
      {target && <button className="btn" type="button" onClick={() => onDetails(target)}>Ver detalles</button>}
      {host && <button className="btn" type="button" onClick={() => onDetails(host)}>Ver dominio</button>}
    </div>
  </section>;
}
