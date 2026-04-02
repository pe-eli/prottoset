interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-brand-900">{label}</label>}
      <select
        className={`px-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 focus:bg-white transition-all duration-200 ${className}`}
        {...props}
      >
        {safeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
