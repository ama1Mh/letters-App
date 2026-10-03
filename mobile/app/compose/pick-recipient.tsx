import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { TextField } from '@/components/TextField';
import { knownErrorKey } from '@/core/i18n/errorKey';
import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';
import {
  DiscoveryActionError,
  getDiscoveryRepository,
  type DiscoveryErrorCode,
  type SearchResult,
} from '@/data/discovery/discoveryRepository';
import { defaultDesign } from '@/domain/design';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { PersonActionsButton } from '@/features/safety/PersonActionsButton';

const KNOWN_SEARCH_CODES = [
  'query_too_short',
  'rate_limited',
  'unknown',
] as const satisfies readonly DiscoveryErrorCode[];
/**
 * Username search waits for a pause in typing: the server allows 30 searches an hour
 * (`search_users`), and one call per keystroke used ~5 of them per username typed.
 */
export const SEARCH_DEBOUNCE_MS = 400;

const KNOWN_EMAIL_CODES = [
  'invalid_input',
  'rate_limited',
  'unknown',
] as const satisfies readonly DiscoveryErrorCode[];

/**
 * Search UI (PLAN §3.6/DEC-008/009), reached from the compose screen. Selecting a "Write letter"
 * or "Connected" result sets the draft's recipient and goes back; an invite-only user with no
 * connection instead offers "Send connection request", which does not set a recipient (there is
 * nothing to send to yet - PLAN's can_send() rule).
 */
export default function PickRecipientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  // No native header on this screen: keep the back link below the status bar, where it is tappable.
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [emailResult, setEmailResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [requestedIds, setRequestedIds] = useState<ReadonlySet<string>>(new Set());

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every keystroke; a response applies only if no newer query was typed meanwhile.
  const searchGeneration = useRef(0);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  function runSearch(next: string) {
    setQuery(next);
    setError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchGeneration.current += 1;
    const mine = searchGeneration.current;
    const trimmed = next.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    // "Searching" from the first keystroke, so "no results" never flashes during the pause.
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const found = await getDiscoveryRepository().searchUsers(trimmed);
          if (mine === searchGeneration.current) setResults(found);
        } catch (e) {
          if (mine !== searchGeneration.current) return;
          const code = e instanceof DiscoveryActionError ? e.code : 'unknown';
          setError(t(`discovery.error.${knownErrorKey(code, KNOWN_SEARCH_CODES)}`));
        } finally {
          if (mine === searchGeneration.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
  }

  async function runEmailSearch() {
    setError(null);
    try {
      setEmailResult(await getDiscoveryRepository().findUserByEmail(email.trim()));
    } catch (e) {
      const code = e instanceof DiscoveryActionError ? e.code : 'unknown';
      setError(t(`discovery.error.${knownErrorKey(code, KNOWN_EMAIL_CODES)}`));
    }
  }

  async function chooseRecipient(user: SearchResult) {
    const draft = await getDraftsRepository().get(id);
    await getDraftsRepository().save({
      id,
      subject: draft?.subject ?? null,
      body: draft?.body ?? '',
      // A brand-new draft is only stored once it has content (composer autosave), so choosing the
      // recipient first finds no draft yet: save the default design, never `undefined`, which the
      // local store rejects (NOT NULL; found in Phase 12.6 phone QA).
      design: draft?.design ?? defaultDesign(),
      recipientId: user.id,
    });
    router.back();
  }

  async function sendRequest(user: SearchResult) {
    try {
      await getDiscoveryRepository().requestConnection(user.id);
      setRequestedIds((prev) => new Set(prev).add(user.id));
    } catch {
      // Neutral: a failed request (already pending, rate limited, ...) just does not update the
      // button; the user can back out and retry from the connections screen if needed.
    }
  }

  // A plain function (not a component) computing the row's trailing action, called inline during
  // render for each user - kept out of a separately-named component so its `requestedIds` read
  // always reflects the render it was called from.
  function renderResultRow(user: SearchResult) {
    const isWritable = user.receiveMode === 'everyone' || user.connectionState === 'connected';
    const isRequested = user.connectionState === 'pending_out' || requestedIds.has(user.id);
    const isIncoming = user.connectionState === 'pending_in';

    return (
      <View
        key={user.id}
        testID={`pick-recipient-row-${user.id}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Display name with @username beside it, always (CLAUDE.md: look-alike protection). */}
        <View style={{ flex: 1 }}>
          <CorrespondentName person={user} />
        </View>
        {isWritable ? (
          <Button
            testID={`pick-recipient-write-${user.id}`}
            title={t('discovery.writeLetter')}
            onPress={() => void chooseRecipient(user)}
          />
        ) : isRequested ? (
          <AppText variant="muted">{t('discovery.requested')}</AppText>
        ) : isIncoming ? (
          <Pressable
            testID={`pick-recipient-respond-${user.id}`}
            accessibilityRole="button"
            onPress={() => router.push('/connections')}
          >
            <AppText style={{ color: colors.primary }}>{t('discovery.respondToRequest')}</AppText>
          </Pressable>
        ) : (
          <Button
            testID={`pick-recipient-request-${user.id}`}
            title={t('discovery.sendRequest')}
            variant="secondary"
            onPress={() => void sendRequest(user)}
          />
        )}
        <PersonActionsButton
          testID={`pick-recipient-actions-${user.id}`}
          userId={user.id}
          onBlocked={() => {
            setResults((current) => current.filter((item) => item.id !== user.id));
            setEmailResult((current) => (current?.id === user.id ? null : current));
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
        <Pressable
          testID="pick-recipient-back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            minHeight: MIN_TOUCH_TARGET,
          }}
        >
          <DirectionalIcon name="chevron-back" size={18} color={colors.primary} />
          <AppText style={{ color: colors.primary }}>{t('compose.title')}</AppText>
        </Pressable>
        <AppText variant="title">{t('discovery.title')}</AppText>
        <TextField
          testID="pick-recipient-search"
          label={t('discovery.searchPlaceholder')}
          value={query}
          onChangeText={runSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField
              testID="pick-recipient-email"
              label={t('discovery.searchByEmailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <Button
            testID="pick-recipient-email-search"
            title={t('discovery.searchByEmailButton')}
            variant="secondary"
            onPress={() => void runEmailSearch()}
            disabled={!email.trim()}
          />
        </View>
        {error ? (
          <AppText testID="pick-recipient-error" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        {emailResult ? renderResultRow(emailResult) : null}
      </View>
      {searching ? (
        <ActivityIndicator testID="pick-recipient-searching" style={{ margin: spacing.md }} />
      ) : null}
      {!searching && !error && query.trim().length >= 3 && results.length === 0 ? (
        <AppText testID="pick-recipient-no-results" variant="muted" style={{ textAlign: 'center' }}>
          {t('discovery.noResults')}
        </AppText>
      ) : null}
      {/* A plain map, not FlatList: results are capped at 20 (search_users()'s own `limit 20`),
          too few to need virtualization, and it keeps in-place row updates (e.g. a request just
          sent) simple and immediate. */}
      <ScrollView>{results.map(renderResultRow)}</ScrollView>
    </View>
  );
}
