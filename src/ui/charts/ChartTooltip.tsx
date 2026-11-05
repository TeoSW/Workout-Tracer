import type { TooltipContentProps } from 'recharts';

/** The tooltip opened by a tap. Values lead, and each one keeps its series color as a short key. */
export function ChartTooltip(
  props: TooltipContentProps & {
    formatLabel: (label: number | string) => string;
    formatValue: (value: number) => string;
  },
) {
  const { active, label, payload, formatLabel, formatValue } = props;
  const items = (payload ?? []).filter((item) => typeof item.value === 'number');
  if (!active || items.length === 0) return null;
  return (
    <div className="chart-tooltip" data-testid="chart-tooltip">
      <div className="chart-tooltip-label">{label === undefined ? '' : formatLabel(label)}</div>
      {items.map((item) => (
        <div key={String(item.dataKey)} className="chart-tooltip-row">
          <span className="chart-tooltip-key" style={{ background: item.color }} />
          <strong>{formatValue(Number(item.value))}</strong>
          {items.length > 1 && <span>{item.name}</span>}
        </div>
      ))}
    </div>
  );
}
