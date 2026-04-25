interface MetricInput {
  name: string;
  value?: number;
  labels?: Record<string, string | number | boolean | null | undefined>;
}

interface DurationInput {
  name: string;
  startedAt: number;
  labels?: Record<string, string | number | boolean | null | undefined>;
}

function buildMetricKey(name: string, labels?: Record<string, string | number | boolean | null | undefined>): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const normalized = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join(',');
  return normalized ? `${name}|${normalized}` : name;
}

class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly durations = new Map<string, { count: number; totalMs: number; maxMs: number }>();

  increment(input: MetricInput): void {
    const key = buildMetricKey(input.name, input.labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + (input.value ?? 1));
  }

  observeDuration(input: DurationInput): void {
    const durationMs = Math.max(0, Date.now() - input.startedAt);
    const key = buildMetricKey(input.name, input.labels);
    const current = this.durations.get(key) ?? { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    this.durations.set(key, current);
  }

  snapshot(): {
    counters: Array<{ key: string; value: number }>;
    durations: Array<{ key: string; count: number; totalMs: number; avgMs: number; maxMs: number }>;
  } {
    return {
      counters: Array.from(this.counters.entries()).map(([key, value]) => ({ key, value })),
      durations: Array.from(this.durations.entries()).map(([key, value]) => ({
        key,
        count: value.count,
        totalMs: value.totalMs,
        avgMs: value.count > 0 ? value.totalMs / value.count : 0,
        maxMs: value.maxMs,
      })),
    };
  }
}

export const metricsService = new MetricsService();
