import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

async function openDisplayName(profileTab: string) {
  await fireEvent.press(screen.getAllByText(profileTab)[0]);
  await waitFor(() => expect(screen.getByTestId('profile-display-name-row')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('profile-display-name-row'));
  await waitFor(() => expect(screen.getByTestId('display-name-screen')).toBeTruthy());
}

describe('Changing the display name (ar/RTL)', () => {
  it('blocks an invalid name locally and shows the server refusal in Arabic', async () => {
    await renderShellIn('ar');
    await openDisplayName('الملف الشخصي');

    for (const invalid of ['a@b', 'Mirsal']) {
      await fireEvent.changeText(screen.getByTestId('display-name-input'), invalid);
      expect(screen.getByTestId('display-name-input-error')).toBeTruthy();
      expect(screen.getByTestId('display-name-save').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    }

    // A word only the server's reserved list has (the fake stands in for its trigger).
    await fireEvent.changeText(screen.getByTestId('display-name-input'), 'Server Reserved');
    await fireEvent.press(screen.getByTestId('display-name-save'));
    await waitFor(() =>
      expect(screen.getByTestId('display-name-error')).toHaveTextContent(
        'هذا الاسم المعروض غير متاح.',
      ),
    );
  });
});
