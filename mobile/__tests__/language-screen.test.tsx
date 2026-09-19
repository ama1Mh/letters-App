import Storage from 'expo-sqlite/kv-store';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { i18n } from '../src/core/i18n';
import { renderShellIn } from './helpers/renderShell';

describe('language screen', () => {
  it('switching en -> ar persists, translates, and asks to restart (direction change)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderShellIn('en');

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-language-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('profile-language-row'));
    await waitFor(() => expect(screen.getByTestId('language-screen')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('language-option-ar'));

    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('إعادة التشغيل مطلوبة');
    expect(message).toBe('يلزم إعادة تشغيل التطبيق لتغيير اتجاه الواجهة.');
    expect(buttons?.map((b) => b.text)).toEqual(['لاحقًا', 'إعادة التشغيل الآن']);
    expect(Storage.getItemSync('i18n.languagePreference')).toBe('ar');
    expect(i18n.language).toBe('ar');
  });
});
