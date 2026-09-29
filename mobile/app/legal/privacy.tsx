import { LegalDocumentView } from '@/features/legal/LegalDocumentView';
import { PRIVACY_POLICY } from '@/features/legal/privacyPolicy';

/** The privacy policy (DEC-053). Reachable signed in (Profile) and signed out (Sign up), so it
 *  lives outside both route groups. */
export default function PrivacyPolicyScreen() {
  return <LegalDocumentView document={PRIVACY_POLICY} testID="privacy-policy-screen" />;
}
