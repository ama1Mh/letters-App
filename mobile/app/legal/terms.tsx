import { LegalDocumentView } from '@/features/legal/LegalDocumentView';
import { TERMS } from '@/features/legal/terms';

/** The terms of service (DEC-054). Reachable signed in (Profile) and signed out (Sign up). */
export default function TermsScreen() {
  return <LegalDocumentView document={TERMS} testID="terms-screen" />;
}
