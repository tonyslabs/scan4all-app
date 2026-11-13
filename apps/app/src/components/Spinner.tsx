export default function Spinner({ size = 'md', label = 'Cargando' }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return <span className={`spin spin-${size}`} role="status" aria-label={label} />;
}
