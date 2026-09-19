# Phase 0 — Environment Setup: Status & Checklist

Rewritten: 2026-09-19 · Machine: Windows 11 Home (10.0.26200), PowerShell · Project: `D:\dev\tab\letters`

This file replaces the earlier draft, which was written before the machine was fully inspected and contained wrong assumptions (for example, that the Android SDK was missing). It now reflects **verified, actual state** plus what was changed and what is deliberately left alone.

**Phase 0 goal:** the machine can build and run an Android app, the repo exists, and the decisions are recorded. **No application code is written in Phase 0.**

**Overall status: Phase 0 is functionally complete.** Open items are listed in §7 and §8; Phase 1 starts only when the owner says "go".

---

## 1. Verified machine state

### Hardware and OS
| Item | Value |
|---|---|
| OS | Windows 11 Home, build 10.0.26200 |
| CPU | AMD Ryzen 5 3500U (4 cores / 8 threads), virtualization enabled in firmware |
| RAM | **7.1 GB total** — the main constraint (see §5) |
| Disk | C: ≈ 17 GB free · D: ≈ 34 GB free (projects, SDK, Gradle, AVD and npm cache all live on D:) |
| Hypervisor | `emulator -accel-check` → **WHPX (10.0.26200) installed and usable** |
| WSL / Docker | **Not installed** (deliberately deferred, §5) |

### Tooling
| Tool | State | Notes |
|---|---|---|
| **Node.js** | **v22.23.2** (MSI, `C:\Program Files\nodejs`) | Even-numbered LTS line. Meets Expo's stated minimum (Node ≥ 22.13 per docs.expo.dev, 2026-09-18 — confirm with `npx expo-doctor` in Phase 1). Replaced v23.9.0 on 2026-09-19 |
| **npm** | **11.4.2** | The *global* npm in `%APPDATA%\npm` takes priority over Node 22's bundled npm 10.x. Prefix `C:\Users\amalm\AppData\Roaming\npm`, cache `D:\npm-cache` |
| Global npm packages | `eas-cli@18.1.0`, `npm@11.4.2`, `yarn@1.22.22` | Global `expo` and `@expo/cli` were **removed** (2026-09-18); use `npx expo` from inside the project |
| **EAS CLI** | 18.1.0, logged in (`eas whoami` works) | Reports 24.7.0 available. **Upgrade deliberately deferred by the owner** |
| **JDK** | Oracle JDK 17.0.12, `JAVA_HOME=C:\Program Files\Java\jdk-17` | Expo's Android guide specifies JDK 17 |
| **Git** | 2.48.1, identity configured | Repo initialized, see §6 |
| VS Code | 1.138.0 | |
| winget | available | |
| PowerShell execution policy (CurrentUser) | RemoteSigned | |
| Windows long paths | Enabled (registry `LongPathsEnabled=1`) | Git's own `core.longpaths` is not set (§6) |

### Android SDK — `D:\APPS\Android\Sdk` (14.7 GB, complete and usable)
| Component | Installed |
|---|---|
| Platforms | 34, 35, **36** (Expo docs require compile/target SDK 36) |
| Build-tools | 33.0.1, 35.0.0, 35.0.1, **36.0.0**, 36.1.0 |
| Command-line tools | `latest` (19.0) |
| Platform-tools | 36.0.2 |
| Emulator | 36.3.10 |
| NDK | 27.1.12297006, 29.0.14206865 |
| CMake | 3.22.1, 4.1.2 |
| System images (Google APIs + **Play Store**, x86_64) | API 33, API 35, API 36.1 |
| Licenses | accepted |

Android Studio is **not installed** and is not needed (cmdline-tools + Gradle are sufficient; Studio would also cost RAM).

### Environment variables (user level — set 2026-09-18)
| Variable | Value |
|---|---|
| `ANDROID_HOME` | `D:\APPS\Android\Sdk` |
| `ANDROID_SDK_ROOT` | `D:\APPS\Android\Sdk` |
| `GRADLE_USER_HOME` | `D:\APPS\gradle` (6 GB of existing caches and wrapper distributions) |
| `ANDROID_AVD_HOME` | `D:\APPS\Android\avd` |
| `JAVA_HOME` | `C:\Program Files\Java\jdk-17` |

User PATH additions: `D:\APPS\Android\Sdk\platform-tools`, `…\emulator`, `…\cmdline-tools\latest\bin`. The **machine-level PATH was not modified** by me (the Node installer did reorder some entries; see §3).

### Emulator
| Item | Value |
|---|---|
| AVD | **`Pixel5_API35`** at `D:\APPS\Android\avd\Pixel5_API35.avd` (~3 GB) |
| Image | Android 15 (API 35), Google Play, x86_64 |
| Device profile | Pixel 5 (1080×2340, 440 dpi), 4 vCPUs |
| RAM | `hw.ramSize=2048` (guest reports ≈ 1.93 GB) |
| Graphics | `hw.gpu.enabled=yes`, mode `auto` (host AMD Radeon Vega 8) |
| Play Store | `PlayStore.enabled=true`; `com.android.vending` and Google Play services present |
| Data partition | 2 GB (raise if a dev build reports "insufficient storage") |
| Verified | Booted (~4 min cold), `adb devices` showed `emulator-5554  device`, then shut down cleanly |

Start it with:
```powershell
emulator -avd Pixel5_API35 -no-snapshot-save -no-boot-anim
```

---

## 2. Decisions recorded in Phase 0
- **Development Android package ID: `com.letterapp.dev`** — development-only. The production ID is chosen at the naming freeze (DEC-001 in `docs/DECISIONS.md`).
- **DEC-007 accepted**: connection request + accept/decline flow, plus invite link/code/QR (auto-accepted).
- A **physical Android device is not required for Phase 0 or Phase 1**. The Phase 1 spike (bidi `TextInput`, Arabic fonts, date-picker language, Western digits/Gregorian `Intl`, language-switch reload) can run on the emulator. A real phone is **recommended before Phase 7** (push notifications, real keyboards) and because the emulator is heavy on 7 GB of RAM.

---

## 3. What was changed on this machine (change log)

| Date | Change | Rollback |
|---|---|---|
| 2026-09-18 | Set user-level `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `GRADLE_USER_HOME`, `ANDROID_AVD_HOME`; appended 3 SDK folders to user PATH; created empty `D:\APPS\Android\avd` | Previous user values were saved to a backup file in the Claude session scratchpad (temporary folder — copy it out if you want to keep it) |
| 2026-09-18 | `npm uninstall -g expo @expo/cli` | `npm i -g expo@<ver> @expo/cli@<ver>` (not recommended) |
| 2026-09-19 | Uninstalled Node 23.9.0 (MSI) and installed **Node 22.23.2** (installer hash-verified, valid OpenJS Foundation signature) | Reinstall the desired version via MSI |
| 2026-09-19 | **Side effect of the Node installer:** it *re-ordered* PATH entries, adding and removing nothing. Machine PATH: `C:\Program Files\nodejs\` moved from position 8 to last. User PATH: `%APPDATA%\npm` moved to last. No other `node.exe` exists on PATH, so resolution is unchanged | Reorder manually if ever needed (machine PATH needs admin) |
| 2026-09-19 | Created AVD `Pixel5_API35`; edited its `config.ini`: `hw.ramSize` `2G`→`2048`, `PlayStore.enabled` `no`→`true`, `hw.gpu.enabled` `no`→`yes` | Delete the two files in `D:\APPS\Android\avd`, or restore from the backed-up original config |

Nothing else was installed, uninstalled, or modified.

---

## 4. Known quirks left **on purpose** (owner decision, 2026-09-19 — not to-dos)

These were identified and deliberately **not** cleaned up. Do not "fix" them without the owner's say-so.

| Quirk | Consequence |
|---|---|
| Duplicate adb: `C:\Users\amalm\tool-kit\platform-tools` (36.0.0) comes first on the machine PATH; the SDK's adb is 36.0.2. There is also a stub SDK at `%LOCALAPPDATA%\Android\Sdk` containing only `platform-tools` | Both speak adb protocol 41, so they coexist. The emulator log shows it probing both copies |
| `D:\APPS\Android\Sdk\platform-tools.backup` (adb 35.0.2) sits inside the SDK | `sdkmanager` prints a duplicate-package warning on every call. Harmless |
| `ndk\26.3.11579264` folder exists but is not registered with `sdkmanager` | Ignore; NDK 27.1 and 29.0 are the registered ones |
| **EAS CLI 18.1.0** is outdated (24.7.0 available) | Upgrade deferred by the owner. If an EAS command fails for version reasons, that is the first suspect |
| Stale machine-level variables `ANDROID_HOME`/`ANDROID_SDK_ROOT=D:\Android\Sdk` and `GRADLE_USER_HOME=D:\gradle` still exist | Overridden by the correct user-level values |
| Dead PATH entries (`C:\flutter\…`, `C:\sdk\flutter\bin`, `C:\xampp\php`, Python 3.13 Scripts, Composer) | Cosmetic |

---

## 5. Constraints that shape the plan (7 GB RAM)
- Running Metro + Gradle + the emulator together is tight (the emulator alone used ≈ 2.3 GB of host RAM and left ≈ 300 MB free). Close Chrome and other heavy apps while building.
- **Phase 1 to-do:** check for an existing `D:\APPS\gradle\gradle.properties` (none exists today) before writing one; plan is to cap the Gradle daemon around 2 GB and build one CPU architecture per target (`x86_64` for this emulator, `arm64-v8a` for a phone).
- If the emulator is sluggish: lower vCPUs to 2 in the AVD config, or use a physical phone.
- **Docker/WSL and local Supabase:** deferred. They are heavy for this machine. Decide in Phase 2 between (a) running pgTAP/RLS tests in GitHub Actions CI against a cloud Supabase dev project, or (b) installing WSL 2 + Docker Desktop locally. Default recommendation: (a).

---

## 6. Repository state (verified 2026-09-19)

| Item | State |
|---|---|
| Repo | Initialized and pushed. Root: `D:\dev\tab\letters` |
| Remote | `origin` → GitHub repository `letters-App` |
| Branches | `main` (1 commit: "Initial commit", README stub) · **`dev`** (current) at `56d504d` "chore: initialize project planning", tracking `origin/dev` |
| Working tree | Clean when checked (before this rewrite). This rewritten file will show as modified until committed |
| Tracked files | `.gitignore`, `CLAUDE.md`, `README.md`, `docs/DECISIONS.md`, `docs/PHASE0_CHECKLIST.md`, `docs/PLAN.md` |
| `.gitignore` | In place and already covers `.env*`, keystores/`*.jks`, `google-services.json`, `service-account*.json`, `node_modules/`, Expo/EAS output, `android/` + `ios/` (Continuous Native Generation), Supabase local dirs, `.claude/settings.local.json` |
| Identity | `user.name` / `user.email` configured (GitHub no-reply address) |

**Optional repo housekeeping — not done, needs the owner's OK:**
- Add `.gitattributes` (`* text=auto eol=lf`) — recommended before source code arrives, to avoid CRLF noise on Windows.
- `git config --global core.longpaths true` (Windows long paths are already enabled at OS level).
- Decide the branching model (`dev` as integration branch, feature branches, when to merge to `main`).

---

## 7. Accounts

| Account | Needed by | Status |
|---|---|---|
| **Expo / EAS** | Phase 1 | ✅ CLI logged in |
| **GitHub** | Phase 0 | ✅ repo exists, `dev` pushed |
| **Supabase** (org + project) | Phase 2 | ☐ not verified — create before Phase 2; pick a region (OPEN-7); store the DB password in a password manager; never paste keys into chat |
| **Google Cloud** (OAuth for Google Sign-In) | Phase 2 | ☐ later. The Android client needs package name `com.letterapp.dev` + the dev-build **SHA-1** |
| **Firebase** (FCM credentials for push) | Phase 7 | ☐ later; tied to the package ID |
| **Google Play Console** | Phase 10 | ☐ later; new personal accounts may need a closed test with a minimum number of testers/days — verify current rules first |
| Domain for invite links | Naming freeze | ☐ later (DEC-012) |
| 2FA on GitHub / Expo / Google / Supabase | now | ☐ owner to confirm (cannot be verified from here) |

---

## 8. Carry-forward to Phase 1

1. **Restart Claude Code (and any open terminals) before Phase 1.** The current Claude Code session was started before the environment fix and still holds the *old* values (`ANDROID_HOME=D:\Android\Sdk`, `GRADLE_USER_HOME=D:\gradle`, no `ANDROID_AVD_HOME`, SDK folders missing from PATH). A restarted session should show `D:\APPS\…` values.
2. Confirm current Expo SDK requirements with `npx expo-doctor` after scaffolding (docs.expo.dev listed SDK 57 / React Native 0.86 / Node ≥ 22.13 / compile SDK 36 on 2026-09-18).
3. Create an **EAS development build** (Expo Go is not sufficient for Android push and native Google Sign-In). Note this uses the EAS version currently installed unless the owner decides otherwise.
4. ~~Fix the stale lines in `CLAUDE.md`~~ **Done (2026-09-19):** the "not yet a git repository" statement now says the directory is a git repository (branch `dev`, remote `origin`), and the Android SDK path is corrected from `D:\Android\Sdk` to `D:\APPS\Android\Sdk` (with `ANDROID_AVD_HOME=D:\APPS\Android\avd` added).

---

## 9. Verification commands (run in a **new** terminal)
```powershell
node -v; npm -v; git --version
java -version
$env:ANDROID_HOME; $env:ANDROID_SDK_ROOT; $env:GRADLE_USER_HOME; $env:ANDROID_AVD_HOME; $env:JAVA_HOME
Get-Command adb -All | Select-Object -ExpandProperty Source
adb version
emulator -accel-check
emulator -list-avds
sdkmanager --list_installed        # a platform-tools.backup warning is expected (§4)
eas whoami
git status -sb; git branch -vv
```
Expected: Node `v22.x` (≥ 22.13), JDK 17, the four `D:\APPS\…` variables, two adb entries (tool-kit first), WHPX usable, `Pixel5_API35`, and branch `dev` tracking `origin/dev`.

---

## 10. Phase 0 exit criteria

- [x] Node is an even-numbered LTS line and meets Expo's minimum (22.23.2)
- [x] Git identity configured; repo initialized; planning docs committed and pushed to `dev`
- [x] Android SDK usable (platform 36, build-tools 36.0.0, cmdline-tools, NDK 27.1) and environment variables correct
- [x] Emulator AVD created; boots with WHPX; `adb devices` detects it
- [x] JDK 17 configured
- [x] Dev package ID chosen: `com.letterapp.dev` (dev-only)
- [x] DEC-007 accepted; decisions recorded in `docs/DECISIONS.md`
- [x] EAS CLI logged in
- [x] Known quirks documented and accepted (§4)
- [ ] Claude Code restarted so its session sees the corrected environment (§8.1)
- [ ] Supabase account/project created (needed by Phase 2, not Phase 1)
- [ ] 2FA confirmed on the accounts above
- [ ] Owner sign-off to start Phase 1

Phase 1 (Foundation + i18n/RTL spike) begins only after the owner says go.
