import Spinner from './Spinner';

export type Section = 'analyze' | 'search' | 'history' | 'settings';
const items: [Section, string][] = [['analyze', 'Analizar'], ['search', 'Buscar'], ['history', 'Historial'], ['settings', 'Ajustes']];

export default function Nav({ section, busy, quiet, onSelect }: {
  section: Section; busy: boolean; quiet: boolean; onSelect: (section: Section) => void;
}) {
  return <header className="bar">
    <span className={`mark${quiet ? ' quiet' : ''}`}>scan4all</span>
    <nav className="menu" aria-label="Principal">
      {items.map(([key, label]) => <button key={key} type="button" className="menu-item"
        aria-current={section === key ? 'page' : undefined} onClick={() => onSelect(key)}>
        {label}{key === 'analyze' && busy && <Spinner size="sm" label="Análisis en curso" />}
      </button>)}
    </nav>
  </header>;
}
