interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

export function Card({ children, className = '', hover = false, gradient = false }: CardProps) {
  const base = 'bg-surface rounded-2xl border border-border p-6 transition-all duration-200';
  const hoverClass = hover ? 'hover:shadow-lg hover:shadow-black/20 hover:border-brand-400/20 hover:-translate-y-0.5 cursor-pointer' : 'shadow-sm shadow-black/10';
  const gradientClass = gradient ? 'bg-gradient-to-br from-surface to-surface-elevated' : '';

  return (
    <div className={`${base} ${hoverClass} ${gradientClass} ${className}`}>
      {children}
    </div>
  );
}
