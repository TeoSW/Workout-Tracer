import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

describe('shell', () => {
  it('seeds the database and opens on Today with five tabs', async () => {
    const { ctx } = renderApp('/');
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today'));
    expect(await screen.findByText('No workouts yet.')).toBeInTheDocument();
    for (const label of ['Today', 'History', 'Progress', 'Programs', 'Settings']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(await ctx.db.exercises.count()).toBe(54);
  });

  it('opens a tab from a deep link', async () => {
    renderApp('/tabs/history');
    expect(await screen.findByText('Finished workouts will show here.')).toBeInTheDocument();
  });
});
