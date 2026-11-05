/** Categorical chart colors, defined in theme.css for light and dark. Slots start at 1. */
export const chartColor = (slot: number) => `var(--chart-${slot})`;

export const AXIS_TICK = { fontSize: 12, fill: 'var(--chart-axis)' };
export const GRID_STROKE = 'var(--chart-grid)';
export const MUTED_FILL = 'var(--chart-muted)';
