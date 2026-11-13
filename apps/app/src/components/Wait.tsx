import type { ScanController } from '../hooks/useScan';
import type { ScanSubmission } from '../types';
import Spinner from './Spinner';
export function localTime(time: number) {
  return new Date(time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
export function Sample({ submission }: { submission: ScanSubmission }) {
  return <p className="file"><b>{submission.name}</b>{submission.kind === 'file' ? ` · ${(submission.file.size / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 2 })} MB` : ' · URL'}</p>;
}
export default function Wait({ scan, submission }: { scan: ScanController; submission: ScanSubmission }) {
  const failed = scan.phase === 'error';
  return <section className="view v-wait" aria-label="Análisis en curso">
    <div className="msg">
      {failed ? <div role="alert"><h1>No se pudo completar.</h1>{scan.error && <p className="error">{scan.error}</p>}</div>
        : <div className="wait-spin"><Spinner size="lg" label="Analizando" /></div>}
      <Sample submission={submission} />
    </div>
    <div className="act">
      {failed && <>
        {scan.timedOut && scan.analysisId && <button className="btn pri" type="button" onClick={scan.continuePolling}>Seguir esperando</button>}
        <button className="btn" type="button" onClick={scan.retry}>Reintentar</button>
      </>}
      <button className="btn" type="button" onClick={scan.cancel}>Cancelar</button>
    </div>
  </section>;
}
