/**
 * Preset avatars (DEC-011). Reads `shared/avatar-catalog.json`, the single source of truth also
 * mirrored by the database (`is_valid_avatar_key()` in 20260929220000_avatars.sql; avatar.test.ts
 * keeps the two in sync). Pure TypeScript: no React, no Supabase.
 */
import catalog from '../../../shared/avatar-catalog.json';

export interface AvatarPreset {
  key: string;
  /** An Ionicons glyph name (rendered by the Avatar component). */
  icon: string;
  color: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = catalog.avatars;

/**
 * What an avatar is drawn from (DEC-011's extensibility point): today only presets; `image` is
 * reserved for user-uploaded avatars in a later version (private bucket + moderation) and is not
 * implemented yet.
 */
export type AvatarSource = { type: 'preset'; key: string } | { type: 'image'; path: string };

export function isValidAvatarKey(key: string | null): boolean {
  return key === null || AVATAR_PRESETS.some((preset) => preset.key === key);
}

export function avatarPreset(key: string | null | undefined): AvatarPreset | null {
  return AVATAR_PRESETS.find((preset) => preset.key === key) ?? null;
}

/** The source for a profile's avatar_key, or null for "no avatar" (or an unknown key). */
export function avatarSourceFromKey(key: string | null | undefined): AvatarSource | null {
  return avatarPreset(key) ? { type: 'preset', key: key as string } : null;
}
