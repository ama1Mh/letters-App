import { Amiri_400Regular } from '@expo-google-fonts/amiri';
import { Cairo_400Regular } from '@expo-google-fonts/cairo';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display';
import { Tajawal_400Regular } from '@expo-google-fonts/tajawal';
import { useFonts } from 'expo-font';

/**
 * Loads every design-catalog font (mobile/src/domain/design.ts / shared/design-catalog.json) once.
 * The keys here must match each catalog font entry's `family` exactly. `expo-font`'s native module
 * is already in the current dev build (it already loads @expo/vector-icons' icon fonts the same
 * way), so unlike expo-secure-store/expo-crypto in Phase 2, this is not expected to need a new
 * native rebuild - unconfirmed, not verified on a device yet.
 *
 * Until loaded, RN silently renders with the system font for an unregistered family name: no crash,
 * just not the intended look yet. Callers are not required to gate rendering on the returned value;
 * `LetterRenderer` looks correct either way, just plainer before this resolves.
 */
export function useDesignFonts(): boolean {
  const [loaded] = useFonts({
    Caveat_400Regular,
    PlayfairDisplay_400Regular,
    Cairo_400Regular,
    Tajawal_400Regular,
    Amiri_400Regular,
  });
  return loaded;
}
