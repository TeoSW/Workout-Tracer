import { describe, expect, it } from 'vitest';
import { APP_ID, APP_NAME } from '../../../src/domain/config';

describe('config', () => {
  it('keeps the app name in one place', () => {
    expect(APP_NAME).toBe('Workout Tracker');
    expect(APP_ID).toBe('workout-tracker');
  });
});
