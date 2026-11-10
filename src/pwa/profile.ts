import { ProfileSchema, type Profile } from '../domain/schemas';

const KEY = 'workout-tracker-profile';

/**
 * Which profile the app opens in. It has to be known before a database opens, so it lives in
 * local storage rather than in either database. Storage that can't be read means your own.
 */
export function getStoredProfile(): Profile {
  try {
    const parsed = ProfileSchema.safeParse(localStorage.getItem(KEY));
    return parsed.success ? parsed.data : 'me';
  } catch {
    return 'me';
  }
}

export function setStoredProfile(profile: Profile): void {
  localStorage.setItem(KEY, profile);
}
