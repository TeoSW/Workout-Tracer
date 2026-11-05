import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileText, saveFile } from '../../src/pwa/files';
import { getStorageStatus } from '../../src/pwa/storage';
import { Stepper } from '../../src/ui/Stepper';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'storage');
});

function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

function stubDownload() {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  return click;
}

describe('saveFile', () => {
  it('uses the share sheet when files can be shared', async () => {
    const share = vi.fn(async () => undefined);
    stubNavigator({ canShare: () => true, share });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('saved');
    expect(share).toHaveBeenCalledOnce();
  });

  it('downloads when sharing files is not available', async () => {
    const click = stubDownload();
    stubNavigator({ canShare: () => false });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
  });

  it('reports a cancelled share sheet and does not download', async () => {
    const click = stubDownload();
    const abort = new DOMException('cancelled', 'AbortError');
    stubNavigator({ canShare: () => true, share: () => Promise.reject(abort) });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails', async () => {
    const click = stubDownload();
    stubNavigator({ canShare: () => true, share: () => Promise.reject(new Error('no')) });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
  });
});

it('reads a picked file as text', async () => {
  expect(await readFileText(new File(['hello'], 'a.txt'))).toBe('hello');
});

describe('getStorageStatus', () => {
  it('reports nothing when the API is missing', async () => {
    expect(await getStorageStatus()).toEqual({ persisted: null, usage: null, quota: null });
  });

  it('reports persistence and usage when available', async () => {
    stubNavigator({
      storage: {
        persisted: async () => true,
        estimate: async () => ({ usage: 2_000_000, quota: 500_000_000 }),
      },
    });
    expect(await getStorageStatus()).toEqual({
      persisted: true,
      usage: 2_000_000,
      quota: 500_000_000,
    });
  });
});

describe('Stepper', () => {
  function Harness() {
    const [value, setValue] = useState(2);
    return <Stepper label="Sets" value={value} onChange={setValue} min={1} max={3} />;
  }

  it('steps within its limits, with labelled buttons', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const more = screen.getByLabelText('More sets');
    const less = screen.getByLabelText('Fewer sets');
    await user.click(more);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(more).toHaveProperty('disabled', true);
    await user.click(less);
    await user.click(less);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(less).toHaveProperty('disabled', true);
  });
});
