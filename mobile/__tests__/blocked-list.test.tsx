import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('Blocked people (Phase 9)', () => {
  it('lists the people I blocked with @username, and unblocks them', async () => {
    const view = await renderShellIn('en', undefined, [], {
      blocked: [
        {
          userId: 'user-pest',
          username: 'pest_user',
          displayName: 'Pest',
          avatarKey: null,
          blockedAt: '2026-09-28T10:00:00.000Z',
        },
      ],
    });
    const unblock = jest.spyOn(view.discovery, 'unblockUser');

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-blocked-row')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/settings/blocked'));
    await waitFor(() => expect(screen.getByTestId('blocked-row-user-pest')).toBeTruthy());
    expect(screen.getByText('Pest')).toBeTruthy();
    expect(screen.getByText('⁦@pest_user⁩')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('blocked-unblock-user-pest'));
    await waitFor(() => expect(screen.getByTestId('blocked-empty')).toBeTruthy());
    expect(unblock).toHaveBeenCalledWith('user-pest');
  });
});
