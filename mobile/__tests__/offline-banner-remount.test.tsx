import { act, screen, waitFor } from 'expo-router/testing-library';

// Only test helpers are imported here (see realtime-inbox.test.tsx).

import { renderShellIn } from './helpers/renderShell';

describe('offline banner: no remount', () => {
  afterEach(() => globalThis.__setNetInfo({ isConnected: true }));

  it('keeps the screen mounted (no state loss) when the banner comes and goes', async () => {
    await renderShellIn('en');
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    const before = screen.getByTestId('inbox-screen');
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => globalThis.__setNetInfo({ isConnected: false }));
    expect(screen.getByTestId('inbox-screen')).toBe(before);
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => globalThis.__setNetInfo({ isConnected: true }));
    expect(screen.getByTestId('inbox-screen')).toBe(before);
  });
});
