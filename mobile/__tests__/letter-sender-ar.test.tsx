import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import ar from '../src/core/i18n/locales/ar.json';
import { ME, SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Reading view as the sender (ar/RTL)', () => {
  it('shows who it went to and the read state, never marks it read, and keeps the body direction', async () => {
    const view = await renderShellIn(
      'ar',
      undefined,
      [],
      {},
      {
        letters: [
          letter({
            id: 'mine',
            viewerRole: 'sender',
            sender: ME,
            recipient: SARA,
            body: 'Hello from an English letter',
            bodyDir: 'ltr',
            readAt: '2026-09-28T12:00:00.000Z',
          }),
        ],
      },
    );
    const markRead = jest.spyOn(view.letters, 'markRead');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/mine'));
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());

    expect(screen.getByText(`${ar.sent.to} Sara`)).toBeTruthy();
    expect(screen.getByTestId('letter-read')).toHaveTextContent(ar.sent.read);
    expect(screen.getByTestId('letter-when')).not.toHaveTextContent(/[٠-٩]/);
    // An English letter keeps LTR inside the Arabic UI (body_dir is independent of the UI).
    expect(StyleSheet.flatten(screen.getByTestId('letter-body-body').props.style)).toMatchObject({
      writingDirection: 'ltr',
    });
    expect(markRead).not.toHaveBeenCalled();
    // Only the recipient can reply.
    expect(screen.queryByTestId('letter-reply')).toBeNull();
  });
});
