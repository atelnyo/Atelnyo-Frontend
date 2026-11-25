import { describe, expect, it, vi } from 'vitest';

import {
  STUDIO_CHANGED_EVENT, notifyStudioChanged, onStudioChanged,
} from './studioEvents';

describe('studioEvents', () => {
  it('delivers the detail payload to subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = onStudioChanged(handler);

    notifyStudioChanged({ section: 'courses' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ section: 'courses' });
    unsubscribe();
  });

  it('uses an empty detail when none is given', () => {
    const handler = vi.fn();
    const unsubscribe = onStudioChanged(handler);

    notifyStudioChanged();

    expect(handler).toHaveBeenCalledWith({});
    unsubscribe();
  });

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn();
    onStudioChanged(handler)();

    notifyStudioChanged({ section: 'orders' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('exposes a stable, namespaced event name', () => {
    expect(STUDIO_CHANGED_EVENT).toBe('atelnyo:studio:changed');
  });
});
