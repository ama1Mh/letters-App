import { screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('sign-in screen (AR / RTL)', () => {
  it('renders translated Arabic text, no English UI strings', async () => {
    await renderShellIn('ar', { session: null, profile: null });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());

    // Title and submit button intentionally share the same string (see ARABIC_REVIEW.md).
    expect(screen.getAllByText('تسجيل الدخول').length).toBe(2);
    expect(screen.getByText('البريد الإلكتروني')).toBeTruthy();
    expect(screen.getByText('كلمة المرور')).toBeTruthy();
    expect(screen.getByText('ليس لديك حساب؟')).toBeTruthy();
    expect(screen.getByText('إنشاء حساب')).toBeTruthy();
    for (const label of ['Sign in', 'Email', 'Password', "Don't have an account?"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
