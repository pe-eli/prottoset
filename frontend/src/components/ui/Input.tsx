interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-brand-900">{label}</label>}
      <input
        className={`px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 focus:bg-white transition-all duration-200 ${className}`}
        {...props}
      />
    </div>
  );
}
