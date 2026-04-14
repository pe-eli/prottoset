interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3 text-base gap-2.5',
  };

  const variants = {
    primary: 'bg-brand-400 text-white shadow-md shadow-brand-400/20 hover:bg-brand-500 active:scale-[0.98]',
    secondary: 'bg-brand-400/10 text-brand-400 hover:bg-brand-400/20 active:scale-[0.98]',
    outline: 'border border-border text-text-primary hover:bg-white/[0.04] hover:border-border-light active:scale-[0.98]',
    ghost: 'text-brand-400 hover:bg-brand-400/10 active:scale-[0.98]',
    danger: 'bg-red-400/10 text-red-400 hover:bg-red-400/20 active:scale-[0.98]',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
