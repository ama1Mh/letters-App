import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Reporting a person (Phase 9)', () => {
  it('needs a reason, sends the report with the letter and details, and can also block', async () => {
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      { letters: [letter({ id: 'from-sara' })] },
    );
    const report = jest.spyOn(view.letters, 'reportUser');
    const block = jest.spyOn(view.discovery, 'blockUser');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/from-sara'));
    await waitFor(() => expect(screen.getByTestId('letter-report')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('letter-report'));
    await waitFor(() => expect(screen.getByTestId('report-screen')).toBeTruthy());

    expect(screen.getByTestId('report-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('report-reason-harassment'));
    await fireEvent.changeText(screen.getByTestId('report-details'), '  unkind words  ');
    await fireEvent(screen.getByTestId('report-also-block'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('report-submit'));

    await waitFor(() => expect(screen.getByTestId('report-done')).toBeTruthy());
    expect(screen.getByText(en.report.sent)).toBeTruthy();
    expect(report).toHaveBeenCalledWith(SARA.id, 'harassment', 'from-sara', 'unkind words');
    expect(block).toHaveBeenCalledWith(SARA.id);
    // Blocking happens only after the report went through.
    expect(report.mock.invocationCallOrder[0]).toBeLessThan(block.mock.invocationCallOrder[0]);
  });
});
