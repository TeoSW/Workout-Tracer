import { Bar, BarChart, LabelList, ReferenceArea, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, GRID_STROKE, chartColor } from './tokens';

export type MuscleBarRow = { muscle: string; sets: number };

const ROW_HEIGHT = 26;
const AXIS_HEIGHT = 28;
const VALUE_LABEL = { fontSize: 12, fill: 'var(--ion-text-color)' };

/** Sets per muscle, each with its value, over the reference band. */
export function MuscleBars(props: {
  rows: readonly MuscleBarRow[];
  reference: { min: number; max: number };
}) {
  const { rows, reference } = props;
  const top = Math.max(reference.max, ...rows.map((r) => r.sets));
  return (
    <BarChart
      responsive
      layout="vertical"
      style={{ width: '100%', height: rows.length * ROW_HEIGHT + AXIS_HEIGHT }}
      data={[...rows]}
      margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
    >
      <XAxis
        type="number"
        domain={[0, top]}
        tick={AXIS_TICK}
        tickLine={false}
        stroke={GRID_STROKE}
      />
      <YAxis
        type="category"
        dataKey="muscle"
        width={84}
        interval={0}
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
      />
      <ReferenceArea
        x1={reference.min}
        x2={reference.max}
        fill={chartColor(1)}
        fillOpacity={0.12}
        stroke="none"
      />
      <Bar dataKey="sets" fill={chartColor(1)} radius={[0, 4, 4, 0]} isAnimationActive={false}>
        <LabelList dataKey="sets" position="right" style={VALUE_LABEL} />
      </Bar>
    </BarChart>
  );
}
