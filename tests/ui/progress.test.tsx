import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

describe('progress', () => {
  it('loads its lazy section and shows the empty state', async () => {
    renderApp('/tabs/progress');
    expect(
      await screen.findByText('Stats will show here once you log workouts.'),
    ).toBeInTheDocument();
  });
});
