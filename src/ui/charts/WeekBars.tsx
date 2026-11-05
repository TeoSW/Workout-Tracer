import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, GRID_STROKE, MUTED_FILL, chartColor } from './tokens';

export type WeekBarRow = { label: string; planned: number | null; finished: number };

/** Finished sessions per week, beside the plan when there is one. */
export function WeekBars({ rows }: { rows: readonly WeekBarRow[] }) {
  const hasPlan = rows.some((r) => r.planned !== null);
  return (
    <BarChart
      responsive
      style={{ width: '100%', height: 180 }}
      data={[...rows]}
      barGap={2}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
    >
      <CartesianGrid vertical={false} stroke={GRID_STROKE} />
      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} stroke={GRID_STROKE} />
      <YAxis width={24} allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
      {hasPlan && <Legend wrapperStyle={{ fontSize: 13 }} />}
      {hasPlan && (
        <Bar
          name="Planned"
          dataKey="planned"
          fill={MUTED_FILL}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      )}
      <Bar
        name="Finished"
        dataKey="finished"
        fill={chartColor(1)}
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
      />
    </BarChart>
  );
}
