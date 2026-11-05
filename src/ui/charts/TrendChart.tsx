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
import type { ChartRow, ChartSeries } from '../../domain/exercise-series';
import { formatShortDate } from '../../domain/format';
import { ChartTooltip } from './ChartTooltip';
import { AXIS_TICK, GRID_STROKE, chartColor } from './tokens';

const formatDay = (day: number | string) => formatShortDate(dateOfDayNumber(Number(day)));

/** Past this many sessions on one line, points only add noise. A tap still marks the nearest. */
const MAX_POINTS = 24;

/** Change over real time on one Y axis. Only series with the same unit share a chart. */
export function TrendChart(props: {
  rows: readonly ChartRow[];
  series: readonly ChartSeries[];
  formatValue: (value: number) => string;
  /** For band levels, where a lower number is harder and up should mean progress. */
  reversed?: boolean;
  /** Fixed Y ticks, for a scale with known ends such as a share. */
  yTicks?: readonly number[];
  height?: number;
}) {
  const { rows, series, formatValue, reversed = false, yTicks, height = 200 } = props;
  const dense = series.length === 1 && rows.length > MAX_POINTS;
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
        domain={yTicks ? [yTicks[0] ?? 0, yTicks.at(-1) ?? 1] : ['auto', 'auto']}
        reversed={reversed}
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        tickCount={4}
        {...(yTicks ? { ticks: [...yTicks], tickFormatter: formatValue } : {})}
      />
      <Tooltip trigger="click" content={tooltip} />
      {series.length > 1 && (
        <Legend iconType="plainline" itemSorter={null} wrapperStyle={{ fontSize: 13 }} />
      )}
      {series.map((s) => (
        <Line
          key={s.key}
          name={s.label}
          dataKey={s.key}
          stroke={chartColor(s.slot)}
          strokeWidth={s.dotsOnly ? 0 : 2}
          dot={dense || s.lineOnly ? false : { r: 3, fill: chartColor(s.slot), stroke: 'none' }}
          activeDot={{ r: 6 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );
}
