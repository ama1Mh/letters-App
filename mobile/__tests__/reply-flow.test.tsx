import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Replying to a letter', () => {
  it('creates a reply draft to the sender with the parent, a fixed recipient, and sends it', async () => {
    mockAlerts('confirm');
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      { letters: [letter({ id: 'from-sara', subject: 'Hello' })] },
    );
    const send = jest.spyOn(view.letters, 'sendLetter');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/from-sara'));
    await waitFor(() => expect(screen.getByTestId('letter-reply')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('letter-reply'));

    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    // The recipient is fixed for a reply: a label, not the picker row.
    await waitFor(() =>
      expect(screen.getByTestId('compose-reply-recipient')).toHaveTextContent(
        en.compose.replyRecipient,
      ),
    );
    expect(screen.queryByTestId('compose-recipient-row')).toBeNull();

    const drafts = await view.drafts.list();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      parentLetterId: 'from-sara',
      recipientId: SARA.id,
      subject: 'Re: Hello',
    });

    await fireEvent.changeText(screen.getByTestId('compose-body'), 'Thank you, Sara!');
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );
    await fireEvent.press(screen.getByTestId('compose-send'));
    await waitFor(() => expect(screen.getByTestId('sent-screen')).toBeTruthy());
    expect(send).toHaveBeenCalledWith(drafts[0].id, null);
  });
});
