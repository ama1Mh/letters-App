import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

/** The auth gate: which stack the app lands on depends on session + onboarding state. */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') return null; // session not checked yet
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'needsOnboarding') return <Redirect href="/onboarding" />;
  return <Redirect href="/inbox" />;
}
