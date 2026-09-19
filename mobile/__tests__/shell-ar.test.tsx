import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('app shell (AR / RTL)', () => {
  it('renders the same shell in Arabic with no English UI text, and switches tabs', async () => {
    await renderShellIn('ar');

    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    expect(screen.getByText('لا توجد رسائل بعد')).toBeTruthy();
    for (const label of ['الوارد', 'المسودات', 'المرسلة', 'الملف الشخصي']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const label of ['Inbox', 'Drafts', 'Sent', 'Profile']) {
      expect(screen.queryByText(label)).toBeNull();
    }

    await fireEvent.press(screen.getAllByText('المسودات')[0]);
    await waitFor(() => expect(screen.getByTestId('drafts-screen')).toBeTruthy());
    expect(screen.getByText('لا توجد مسودات')).toBeTruthy();
  });
});
