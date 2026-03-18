interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3 text-base gap-2.5',
  };

  const variants = {
    primary: 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 hover:brightness-110 active:scale-[0.98]',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:scale-[0.98]',
    outline: 'border border-border text-brand-700 hover:bg-brand-50 hover:border-brand-200 active:scale-[0.98]',
    ghost: 'text-brand-600 hover:bg-brand-50 active:scale-[0.98]',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98]',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
