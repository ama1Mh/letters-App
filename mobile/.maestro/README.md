# Maestro E2E flows

Verified 2026-10-01 with Maestro 2.11.0 on the owner's phone (dev client, `com.letterapp.dev`).

Prerequisites: the dev client installed, Metro running on port 8081 with `adb reverse tcp:8081
tcp:8081`, and a signed-in, onboarded account (the QA account). Sign-in is not automated here on
purpose: Maestro prints typed text in its output, which would expose the password.

```
maestro test .maestro            # from mobile/; runs every flow in flows/
maestro test .maestro/flows/02-compose-draft.yaml
```

Selectors are React Native `testID`s (Maestro's `id:`), so the flows do not depend on the UI
language. Tabs are tapped by their label (`tab-<name>-label`, set in `app/(tabs)/_layout.tsx`):
in dev builds a LogBox warning toast can cover the top of the tab bar and swallow taps there.
Do not run Maestro while Gradle or Jest is running on this 7 GB machine.
