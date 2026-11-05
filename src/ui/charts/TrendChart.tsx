import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { dateOfDayNumber } from '../../domain/dates';
import { formatShortDate } from '../../domain/format';
import { ChartTooltip } from './ChartTooltip';
import { AXIS_TICK, GRID_STROKE, chartColor } from './tokens';

export type TrendSeries = {
  key: string;
  label: string;
  /** Categorical color slot, kept by the series whatever else is showing. */
  slot: number;
  /** Plots points without a line, for raw values under an average. */
  dotsOnly?: boolean;
};

/** One point in time. `day` comes from dayNumber, so gaps between sessions show as gaps. */
export type TrendRow = { day: number } & Record<string, number | null>;

const formatDay = (day: number | string) => formatShortDate(dateOfDayNumber(Number(day)));

/** Change over real time on one Y axis. Only series with the same unit share a chart. */
export function TrendChart(props: {
  rows: readonly TrendRow[];
  series: readonly TrendSeries[];
  formatValue: (value: number) => string;
  /** For band levels, where a lower number is harder and up should mean progress. */
  reversed?: boolean;
  height?: number;
}) {
  const { rows, series, formatValue, reversed = false, height = 200 } = props;
  const tooltip = (tip: TooltipContentProps) => (
    <ChartTooltip {...tip} formatLabel={formatDay} formatValue={formatValue} />
  );
  return (
    <LineChart
      responsive
      style={{ width: '100%', height }}
      data={[...rows]}
      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
    >
      <CartesianGrid vertical={false} stroke={GRID_STROKE} />
      <XAxis
        dataKey="day"
        type="number"
        domain={['dataMin', 'dataMax']}
        tickCount={4}
        tickFormatter={formatDay}
        tick={AXIS_TICK}
        tickLine={false}
        stroke={GRID_STROKE}
      />
      <YAxis
        width="auto"
        domain={['auto', 'auto']}
        reversed={reversed}
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        tickCount={4}
      />
      <Tooltip trigger="click" content={tooltip} />
      {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />}
      {series.map((s) => (
        <Line
          key={s.key}
          name={s.label}
          dataKey={s.key}
          stroke={chartColor(s.slot)}
          strokeWidth={s.dotsOnly ? 0 : 2}
          dot={{ r: 4, fill: chartColor(s.slot), stroke: 'var(--grouped-card)', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );
}
