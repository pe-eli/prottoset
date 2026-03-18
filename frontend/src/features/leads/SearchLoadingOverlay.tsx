export function SearchLoadingOverlay() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 animate-fade-in">
      {/* Animated dots */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-bounce [animation-delay:0ms]" />
        <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-bounce [animation-delay:150ms]" />
        <div className="w-2.5 h-2.5 rounded-full bg-brand-300 animate-bounce [animation-delay:300ms]" />
      </div>

      {/* Animated text with steps */}
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-brand-950">Gerando leads...</p>
        <div className="space-y-0.5">
          <p className="text-xs text-brand-400">1. Gerando bairros com IA</p>
          <p className="text-xs text-brand-400">2. Buscando no Google Maps</p>
          <p className="text-xs text-brand-400">3. Extraindo emails dos sites</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 bg-brand-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full animate-progress" />
      </div>

      <p className="text-[11px] text-brand-300">Isso pode levar alguns segundos</p>
    </div>
  );
}
