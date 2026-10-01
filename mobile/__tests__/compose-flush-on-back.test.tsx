import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('compose: leaving right after typing', () => {
  it('saves the last edits at once instead of dropping the debounced save', async () => {
    const view = await renderShellIn('en');
    const save = jest.spyOn(view.drafts, 'save');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/compose/quick-leave'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('compose-body'), 'Typed and left at once');
    expect(save).not.toHaveBeenCalled(); // still inside the debounce window

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.back());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toMatchObject({
      id: 'quick-leave',
      body: 'Typed and left at once',
    });
  });
});
