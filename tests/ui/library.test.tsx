import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getExercise, listExercises } from '../../src/data/exercises';
import { ionEvent, renderApp, selectLabelled } from './helpers';

const LIST = '/tabs/programs/library';

function names(): string[] {
  const list = screen.getByTestId('exercise-list');
  return within(list)
    .queryAllByTestId('exercise-name')
    .map((el) => el.textContent ?? '');
}

describe('exercise library', () => {
  it('searches by name, ignoring case', async () => {
    renderApp(LIST);
    expect(await screen.findByText('Pull-ups')).toBeInTheDocument();
    ionEvent(screen.getByLabelText('Search exercises'), 'ionInput', { value: 'deadLIFT' });
    await waitFor(() => expect(names()).toEqual(['Deadlift', 'Romanian Deadlift']));
  });

  it('filters by muscle and by tracking type', async () => {
    renderApp(LIST);
    await screen.findByText('Pull-ups');
    ionEvent(selectLabelled('Muscle'), 'ionChange', { value: 'calves' });
    await waitFor(() => expect(names()).toEqual(['Calf Raise']));
    ionEvent(selectLabelled('Muscle'), 'ionChange', { value: 'all' });
    ionEvent(selectLabelled('Tracking'), 'ionChange', { value: 'attempts' });
    await waitFor(() => expect(names()).toEqual(['360', '540', 'Shrimp Flip']));
  });

  it('says so when nothing matches', async () => {
    renderApp(LIST);
    await screen.findByText('Pull-ups');
    ionEvent(screen.getByLabelText('Search exercises'), 'ionInput', { value: 'zzz' });
    expect(await screen.findByText('No exercises match.')).toBeInTheDocument();
  });

  it('adds a custom exercise', async () => {
    const { ctx, user } = renderApp(`${LIST}/new`);
    ionEvent(await screen.findByLabelText('Name'), 'ionInput', { value: 'Ring Row' });
    ionEvent(selectLabelled('Tracking'), 'ionChange', { value: 'bodyweight_reps' });
    ionEvent(selectLabelled('Primary'), 'ionChange', { value: ['upper_back'] });
    await user.click(screen.getByText('Save'));
    await waitFor(async () => {
      const added = (await listExercises(ctx)).find((e) => e.name === 'Ring Row');
      expect(added).toMatchObject({
        isCustom: true,
        trackingType: 'bodyweight_reps',
        primaryMuscles: ['upper_back'],
        defaultRestSec: 90,
      });
    });
  });

  it('shows an error for a name that is taken', async () => {
    const { user } = renderApp(`${LIST}/new`);
    ionEvent(await screen.findByLabelText('Name'), 'ionInput', { value: 'squat' });
    await user.click(screen.getByText('Save'));
    expect(
      await screen.findByText('An exercise with this name already exists.'),
    ).toBeInTheDocument();
  });

  it('asks for a name', async () => {
    const { user } = renderApp(`${LIST}/new`);
    await screen.findByLabelText('Name');
    await user.click(screen.getByText('Save'));
    expect(await screen.findByText('Give the exercise a name.')).toBeInTheDocument();
  });

  it('shows details and alternatives, and archives', async () => {
    const { ctx, user } = renderApp(`${LIST}/lateral-raise`);
    expect(await screen.findByText('Side delts')).toBeInTheDocument();
    expect(await screen.findByText('Machine Lateral Raise')).toBeInTheDocument();
    await user.click(screen.getByText('Archive exercise'));
    await waitFor(async () =>
      expect((await getExercise(ctx, 'lateral-raise'))?.archived).toBe(true),
    );
  });

  it('lets a built-in exercise change its cues and rest, but not its name', async () => {
    const { ctx, user } = renderApp(`${LIST}/squat/edit`);
    expect(await screen.findByLabelText('Cues')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    ionEvent(screen.getByLabelText('Cues'), 'ionInput', { value: 'Knees out.' });
    await user.click(screen.getByLabelText('More rest seconds'));
    await user.click(screen.getByText('Save'));
    await waitFor(async () =>
      expect(await getExercise(ctx, 'squat')).toMatchObject({
        cues: 'Knees out.',
        defaultRestSec: 135,
        name: 'Squat',
      }),
    );
  });
});
