import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import type { LocalDraft } from '@/data/local/draftsStore';

import { FAKE_PUSH_TOKEN } from './helpers/fakePushPlatform';
import { renderShellIn } from './helpers/renderShell';

const PRIVATE_DRAFT: LocalDraft = {
  id: 'private-draft',
  subject: 'Private',
  body: 'Not for the next account on this device',
  bodyDir: 'ltr',
  design: {},
  recipientId: null,
  dirty: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('sign out', () => {
  it('signs out from the profile tab, clears local drafts, and lands back on sign-in', async () => {
    const view = await renderShellIn('en', undefined, [PRIVATE_DRAFT]); // signed in and onboarded
    const release = jest.spyOn(view.drafts, 'releaseForSignOut');
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    await waitFor(() => expect(view.devices.register).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-screen')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('profile-sign-out-row'));
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());

    // Local drafts are device-wide: the next account must never see or sync this one.
    expect(release).toHaveBeenCalledTimes(1);
    expect(await view.drafts.list()).toEqual([]);
    // This device stops getting this account's notifications, while the session can still ask.
    expect(view.devices.unregister).toHaveBeenCalledWith(FAKE_PUSH_TOKEN);
    expect(view.devices.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      release.mock.invocationCallOrder[0],
    );
  });
});
