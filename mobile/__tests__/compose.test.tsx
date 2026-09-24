import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { renderShellIn } from './helpers/renderShell';

describe('compose (drafts)', () => {
  it('autosaves a new draft, it appears back on the list, and can be deleted', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    const view = await renderShellIn('en');

    await fireEvent.press(screen.getAllByText('Drafts')[0]);
    await waitFor(() => expect(screen.getByTestId('drafts-new-button')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('drafts-new-button'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('compose-subject'), 'My subject');
    await fireEvent.changeText(screen.getByTestId('compose-body'), 'My body');

    // Past the 600ms autosave debounce: poll the repository directly rather than the transient
    // "saving" indicator, which can flip true->false faster than waitFor's polling can observe.
    await waitFor(
      async () => {
        const saved = await view.drafts.list();
        expect(saved.some((d) => d.subject === 'My subject')).toBe(true);
      },
      { timeout: 2000 },
    );

    await fireEvent.press(screen.getByTestId('compose-back'));
    await waitFor(() => expect(screen.getByTestId('drafts-screen')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('My subject')).toBeTruthy(), { timeout: 2000 });
    expect(screen.getByText('My body')).toBeTruthy();

    // Delete it: confirm via the native Alert (mocked to auto-press "Delete").
    const rows = screen.getAllByText('My subject');
    await fireEvent.press(rows[0]);
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('compose-delete'));
    await waitFor(() => expect(screen.getByTestId('drafts-empty')).toBeTruthy());
  });
});
