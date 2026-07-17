type Labels = Record<string, string | number | boolean>;

function labelValue(value: string | number | boolean): string {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
}

function labels(value: Labels | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${key}="${labelValue(entry)}"`)
    .join(",")}}`;
}

type Counter = { name: string; help: string; labels: Labels; value: number };
type Gauge = { name: string; help: string; labels: Labels; value: number };

export class MetricsRegistry {
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  readonly startedAtSeconds = Math.floor(Date.now() / 1000);

  increment(name: string, help: string, value = 1, metricLabels: Labels = {}): void {
    const key = `${name}${labels(metricLabels)}`;
    const current = this.counters.get(key);
    if (current) {
      current.value += value;
      return;
    }
    this.counters.set(key, { name, help, labels: metricLabels, value });
  }

  setGauge(name: string, help: string, value: number, metricLabels: Labels = {}): void {
    const key = `${name}${labels(metricLabels)}`;
    this.gauges.set(key, { name, help, labels: metricLabels, value });
  }

  render(): string {
    const metrics = [...this.counters.values(), ...this.gauges.values()];
    const help = new Map<string, string>();
    for (const metric of metrics) help.set(metric.name, metric.help);
    const lines: string[] = [];
    for (const [name, description] of [...help.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const type = [...this.counters.values()].some((metric) => metric.name === name) ? "counter" : "gauge";
      lines.push(`# HELP ${name} ${description}`, `# TYPE ${name} ${type}`);
      for (const metric of metrics.filter((entry) => entry.name === name).sort((left, right) => labels(left.labels).localeCompare(labels(right.labels)))) {
        lines.push(`${metric.name}${labels(metric.labels)} ${metric.value}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }
}
