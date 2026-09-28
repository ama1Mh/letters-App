import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { renderShellIn } from './helpers/renderShell';

describe('Reading view: a letter the caller may not see', () => {
  it('shows one neutral message and never marks anything read', async () => {
    // The fake has no such letter, so getLetter rejects with not_found, exactly like the RPC does
    // for a draft, someone else's letter, a deleted one or a made-up id.
    const view = await renderShellIn('en');
    const markRead = jest.spyOn(view.letters, 'markRead');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/not-mine'));
    await waitFor(() => expect(screen.getByTestId('letter-error')).toBeTruthy());
    expect(screen.getByText(en.letters.error.not_found)).toBeTruthy();
    expect(screen.queryByTestId('letter-screen')).toBeNull();
    expect(markRead).not.toHaveBeenCalled();
  });
});
