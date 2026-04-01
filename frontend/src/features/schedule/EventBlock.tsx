import type { CalendarEvent } from '../../features/schedule/schedule.types';
import { timeToTopPercent, durationToHeightPercent, CATEGORY_CONFIG } from '../../utils/schedule';

interface EventBlockProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}

export function EventBlock({ event, onClick }: EventBlockProps) {
  const config = CATEGORY_CONFIG[event.category];
  const top = timeToTopPercent(event.startTime);
  const height = durationToHeightPercent(event.startTime, event.endTime);

  return (
    <button
      onClick={() => onClick(event)}
      className={`absolute left-0.5 right-0.5 ${config.bg} border-l-[3px] ${config.border} rounded-r-lg px-2 py-1 overflow-hidden cursor-pointer hover:shadow-md hover:brightness-95 transition-all group z-10`}
      style={{ top: `${top}%`, height: `${height}%`, minHeight: 22 }}
      title={`${event.title}\n${event.startTime} – ${event.endTime}`}
    >
      <p className={`text-[11px] font-semibold ${config.text} truncate leading-tight`}>
        {event.title}
      </p>
      {height > 4 && (
        <p className="text-[10px] text-brand-400 truncate leading-tight">
          {event.startTime} – {event.endTime}
        </p>
      )}
      {event.isRecurring && height > 6 && (
        <span className="text-[9px] text-brand-300 mt-0.5 block">
          recorrente
        </span>
      )}
    </button>
  );
}
