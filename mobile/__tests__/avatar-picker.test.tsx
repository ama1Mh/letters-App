import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('Choosing a preset avatar (DEC-011)', () => {
  it('opens from Profile, saves the chosen preset, marks it, and can clear it', async () => {
    const view = await renderShellIn('en');
    const update = jest.spyOn(view.backend.repository, 'updateAvatar');

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-avatar-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('profile-avatar-row'));
    await waitFor(() => expect(screen.getByTestId('avatar-screen')).toBeTruthy());

    expect(screen.getByTestId('avatar-option-none').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByTestId('avatar-option-rocket'));
    await waitFor(() =>
      expect(screen.getByTestId('avatar-option-rocket').props.accessibilityState).toMatchObject({
        checked: true,
      }),
    );
    expect(update).toHaveBeenLastCalledWith('rocket');
    expect(screen.getByTestId('avatar-option-rocket').props.accessibilityLabel).toMatch(
      /^Avatar \d+$/,
    );

    await fireEvent.press(screen.getByTestId('avatar-option-none'));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(null));
  });
});
