interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

export function Card({ children, className = '', hover = false, gradient = false }: CardProps) {
  const base = 'bg-surface rounded-2xl border border-border-light p-6 transition-all duration-200';
  const hoverClass = hover ? 'hover:shadow-lg hover:shadow-brand-100/50 hover:border-brand-200 hover:-translate-y-0.5 cursor-pointer' : 'shadow-sm';
  const gradientClass = gradient ? 'bg-gradient-to-br from-white to-brand-50/50' : '';

  return (
    <div className={`${base} ${hoverClass} ${gradientClass} ${className}`}>
      {children}
    </div>
  );
}
