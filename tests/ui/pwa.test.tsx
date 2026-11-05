import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playRestTone, resetAudioForTests, unlockAudio } from '../../src/pwa/audio';
import {
  allowSleep,
  isWakeLockSupported,
  keepAwake,
  resetWakeLockForTests,
} from '../../src/pwa/wake-lock';

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
    class FakeContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = resume;
      createOscillator() {
        return { frequency: { value: 0 }, connect: vi.fn(), start, stop: vi.fn() };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    return { start, resume };
  }

  it('stays silent until a tap has unlocked it', () => {
    const { start } = stubAudio();
    expect(playRestTone()).toBe(false);
    expect(start).not.toHaveBeenCalled();
    unlockAudio();
    expect(playRestTone()).toBe(true);
    expect(start).toHaveBeenCalledOnce();
  });

  it('does nothing where Web Audio is missing', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => unlockAudio()).not.toThrow();
    expect(playRestTone()).toBe(false);
  });
});
