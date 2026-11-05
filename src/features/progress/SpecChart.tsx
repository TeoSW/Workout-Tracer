import type { ChartSpec } from '../../domain/exercise-series';
import { formatChartValue } from '../../domain/format';
import { ChartCard } from '../../ui/ChartCard';
import { TrendChart } from '../../ui/charts/TrendChart';

/** One chart from the domain, with its numbers in words above it. */
export function SpecChart({ spec }: { spec: ChartSpec }) {
  return (
    <ChartCard title={spec.title} readout={spec.readout}>
      <TrendChart
        rows={spec.rows}
        series={spec.series}
        reversed={spec.reversed ?? false}
        formatValue={(value) => formatChartValue(value, spec.unit, spec.suffix)}
      />
      {spec.note !== undefined && <p className="chart-note">{spec.note}</p>}
    </ChartCard>
  );
}
