import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import ar from '../src/core/i18n/locales/ar.json';
import { renderShellIn } from './helpers/renderShell';

describe('my invite: load failure (ar)', () => {
  it('shows a translated error with a retry that loads again, and no empty link field', async () => {
    const view = await renderShellIn('ar', undefined, [], {
      fail: { getOrCreateInvite: 'unknown' },
    });
    const load = jest.spyOn(view.discovery, 'getOrCreateInvite');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite'));
    await waitFor(() => expect(screen.getByTestId('my-invite-load-error')).toBeTruthy());
    expect(screen.getByText(ar.invite.loadError)).toBeTruthy();
    expect(screen.queryByTestId('my-invite-link')).toBeNull();
    const calls = load.mock.calls.length;

    await fireEvent.press(screen.getByTestId('my-invite-retry'));
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(screen.getByTestId('my-invite-load-error')).toBeTruthy());
  });
});
