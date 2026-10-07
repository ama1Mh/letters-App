import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

async function openDisplayName(profileTab: string) {
  await fireEvent.press(screen.getAllByText(profileTab)[0]);
  await waitFor(() => expect(screen.getByTestId('profile-display-name-row')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('profile-display-name-row'));
  await waitFor(() => expect(screen.getByTestId('display-name-screen')).toBeTruthy());
}

describe('Changing the display name', () => {
  it('opens from Profile prefilled, saves a new name and shows it on Profile', async () => {
    const view = await renderShellIn('en');
    const update = jest.spyOn(view.backend.repository, 'updateDisplayName');
    await openDisplayName('Profile');

    expect(screen.getByTestId('display-name-input').props.value).toBe('Shell User');
    // Unchanged: nothing to save.
    expect(screen.getByTestId('display-name-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.changeText(screen.getByTestId('display-name-input'), '  Shell Writer ');
    await fireEvent.press(screen.getByTestId('display-name-save'));

    await waitFor(() => expect(screen.getByTestId('profile-screen')).toBeTruthy());
    expect(update).toHaveBeenCalledWith('Shell Writer');
    expect(screen.getAllByText('Shell Writer').length).toBeGreaterThan(0);
  });
});
