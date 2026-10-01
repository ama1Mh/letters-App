import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('compose: a new draft that is left untouched', () => {
  it('is never written, so backing out leaves no empty "Untitled draft" (phone QA)', async () => {
    const view = await renderShellIn('en');
    const save = jest.spyOn(view.drafts, 'save');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/compose/brand-new-id'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.advanceTimersByTime(5_000); // well past the autosave debounce
    });
    expect(save).not.toHaveBeenCalled();

    // Typing still autosaves as before.
    await fireEvent.changeText(screen.getByTestId('compose-body'), 'Hello');
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toMatchObject({ id: 'brand-new-id', body: 'Hello' });
  });
});
