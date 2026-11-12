import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playRestTone, resetAudioForTests, unlockAudio } from '../../src/pwa/audio';
import {
  allowSleep,
  isWakeLockSupported,
  keepAwake,
  resetWakeLockForTests,
} from '../../src/pwa/wake-lock';
import { renderApp } from './helpers';

function fakeSentinel() {
  return {
    released: false,
    release: vi.fn(async function (this: { released: boolean }) {
      this.released = true;
    }),
  };
}

describe('wake lock', () => {
  beforeEach(() => resetWakeLockForTests());
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    resetWakeLockForTests();
  });

  function stubWakeLock() {
    const request = vi.fn(async () => fakeSentinel());
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    return request;
  }

  it('does nothing and does not fail when unsupported', async () => {
    expect(isWakeLockSupported()).toBe(false);
    await expect(keepAwake()).resolves.toBeUndefined();
    await expect(allowSleep()).resolves.toBeUndefined();
  });

  it('requests a screen lock and releases it', async () => {
    const request = stubWakeLock();
    await keepAwake();
    expect(request).toHaveBeenCalledWith('screen');
    const sentinel = await request.mock.results[0]?.value;
    await allowSleep();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('requests again when the page comes back, but only while wanted', async () => {
    const request = stubWakeLock();
    await keepAwake();
    const sentinel = await request.mock.results[0]?.value;
    sentinel.released = true; // iOS drops the lock when the app is hidden
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await allowSleep();
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 10));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('holds one lock when asked twice, so finishing releases it', async () => {
    const request = stubWakeLock();
    await keepAwake();
    await keepAwake();
    expect(request).toHaveBeenCalledOnce();
    const sentinel = await request.mock.results[0]?.value;
    await allowSleep();
    expect(sentinel.release).toHaveBeenCalledOnce();
  });

  it('survives a refused request', async () => {
    const request = vi.fn(() => Promise.reject(new Error('Low battery')));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    await expect(keepAwake()).resolves.toBeUndefined();
  });
});

describe('rest tone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioForTests();
  });

  function stubAudio() {
    const start = vi.fn();
    const resume = vi.fn(async () => undefined);
    const instances: { state: string }[] = [];
    class FakeContext {
      state = 'running';
      constructor() {
        instances.push(this);
      }
      currentTime = 0;
      destination = {};
      resume = resume;
      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start,
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    return { start, resume, instances };
  }

  it('stays silent until a tap has unlocked it', () => {
    const { start } = stubAudio();
    expect(playRestTone()).toBe(false);
    expect(start).not.toHaveBeenCalled();
    unlockAudio();
    expect(playRestTone()).toBe(true);
    // Three double beeps, so it can be heard across a gym.
    expect(start).toHaveBeenCalledTimes(6);
  });

  it('plays as media during the alarm, so silent mode does not mute it, then mixes again', () => {
    vi.useFakeTimers();
    stubAudio();
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    unlockAudio();
    expect(session.type).toBe('ambient');
    playRestTone();
    expect(session.type).toBe('playback');
    vi.advanceTimersByTime(2000);
    expect(session.type).toBe('ambient');
    Reflect.deleteProperty(navigator, 'audioSession');
    vi.useRealTimers();
  });

  it('wakes sound that iOS suspended, on the next tap', () => {
    const { resume, instances } = stubAudio();
    unlockAudio();
    resume.mockClear();
    document.dispatchEvent(new Event('pointerdown'));
    expect(resume).not.toHaveBeenCalled(); // running, nothing to wake
    const [audio] = instances;
    if (!audio) throw new Error('no audio context');
    audio.state = 'interrupted'; // iOS after the app was in the background
    expect(playRestTone()).toBe(false);
    document.dispatchEvent(new Event('pointerdown'));
    expect(resume).toHaveBeenCalledOnce();
  });

  it('plays a test alarm from Settings', async () => {
    const { start } = stubAudio();
    const { user } = renderApp('/tabs/settings');
    await user.click(await screen.findByText('Play test alarm'));
    // Beeps, twice by default: two plays of three double beeps.
    await waitFor(() => expect(start).toHaveBeenCalledTimes(12));
  });

  it('plays the chosen sound the chosen number of times', () => {
    const { start } = stubAudio();
    unlockAudio();
    playRestTone({ sound: 'chime', repeats: 3 });
    expect(start).toHaveBeenCalledTimes(9);
    start.mockClear();
    playRestTone({ sound: 'bell', repeats: 1 });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does nothing where Web Audio is missing', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => unlockAudio()).not.toThrow();
    expect(playRestTone()).toBe(false);
  });
});
