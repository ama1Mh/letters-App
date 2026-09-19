# Phase 0 — Windows Setup Checklist

Machine: Windows 11 Home · shell: PowerShell · project: `D:\dev\tab\letters`
Snapshot taken: 2026-09-18 (read-only checks; nothing was installed or changed).

Goal of Phase 0: your machine can build and run an Android app, you have the accounts you'll need, and the repo is ready. **No app code is written in Phase 0.**

> Tip: in Claude Code you can run a command yourself by typing `! <command>` in the prompt; its output lands in the conversation. Commands marked **(admin)** need an elevated PowerShell ("Run as administrator").

---

## 1. What I found on your machine

| Item | State | Action |
|---|---|---|
| Node.js | **v23.9.0** — odd-numbered (non-LTS, end-of-life) release | ⚠️ Switch to an **LTS** version (step 2) |
| npm | 11.4.2 | OK (comes with Node) |
| Git | 2.48.1 | ✅ (check identity, step 3) |
| JDK | 17.0.12, `JAVA_HOME` set | ✅ Keep JDK 17 |
| Android SDK | `ANDROID_HOME` / `ANDROID_SDK_ROOT` = `D:\Android\Sdk`, but that folder is **empty or missing** (no `platforms`, `build-tools`, `emulator`) | ❌ Install Android Studio + SDK (step 4) |
| `adb` | Standalone copy at `C:\Users\amalm\tool-kit\platform-tools` (adb 1.0.41), on PATH | ⚠️ Can conflict with the SDK's adb (step 5) |
| Android device | None connected (`adb devices` empty) | ❌ Needed for the Phase 1 spike (step 6) |
| Emulator / AVD | None | Optional (step 7) |
| EAS CLI | 18.1.0, **already logged in** to an Expo account | ✅ |
| Windows long paths | Enabled | ✅ |
| PowerShell execution policy (CurrentUser) | RemoteSigned | ✅ |
| VS Code | Installed | ✅ (extensions, step 11) |
| winget | Available | ✅ (used below) |
| Docker Desktop | Not installed | Later — needed by Phase 2 (step 8) |
| Supabase CLI | Not installed | Later — Phase 1/2 (step 9) |
| Virtualization (for emulator/Docker) | Could not check (needs admin) | Check yourself (step 7) |
| Git repo in `D:\dev\tab\letters` | Not initialized | Pending your OK (step 12) |

---

## 2. Node.js → LTS  (required)

Why: Expo/EAS tooling is tested against **even-numbered LTS** releases; Node 23 is a short-lived "Current" release that is now unsupported, and it causes hard-to-diagnose native-module and tooling errors.

Target: **Node 24 LTS** (or Node 22 LTS if the Expo SDK we pick documents that as its supported version — I'll verify in Phase 1).

Option A (simplest): Settings → Apps → uninstall **Node.js**, then:
```powershell
winget install OpenJS.NodeJS.LTS
```
Option B (recommended if you'll keep several Node versions): install **nvm-windows** (`winget install CoreyButler.NVMforWindows`), then `nvm install lts` and `nvm use lts`.

Afterwards **open a new terminal** and verify:
```powershell
node -v      # expect an even major, e.g. v24.x
npm -v
```
Then reinstall EAS CLI if `eas --version` breaks: `npm install -g eas-cli`. (You can also just use `npx eas-cli` and skip the global install.)

## 3. Git identity and settings
```powershell
git config --global user.name              # should print your name
git config --global user.email             # should print the email you use on GitHub
git config --global core.longpaths true
git config --global init.defaultBranch main
```
Set any that are empty (`git config --global user.name "Your Name"`).

## 4. Android Studio + Android SDK  (required)

Your environment variables already point to `D:\Android\Sdk`, so install the SDK there.

1. `winget install Google.AndroidStudio`  (or download from developer.android.com/studio)
2. First-run wizard → choose **Custom** → set **SDK location** to `D:\Android\Sdk`.
3. In Android Studio: **More Actions → SDK Manager**:
   - **SDK Platforms:** the latest stable *Android SDK Platform* (Expo tells us the exact compile SDK in Phase 1 — I'll confirm), plus **Android 8.0 (API 26)** only if you want to test the minimum version on an emulator.
   - **SDK Tools:** ✔ Android SDK Build-Tools · ✔ **Android SDK Command-line Tools (latest)** · ✔ Android SDK Platform-Tools · ✔ Android Emulator · (NDK/CMake: leave to Gradle, it downloads what it needs).
4. Verify:
```powershell
Test-Path D:\Android\Sdk\platform-tools\adb.exe        # True
Test-Path D:\Android\Sdk\emulator\emulator.exe          # True (if Emulator installed)
Get-ChildItem D:\Android\Sdk\build-tools                # at least one version folder
```

## 5. PATH — avoid two different `adb` versions
A second `adb` (yours in `tool-kit\platform-tools`) plus the SDK's causes the classic *"adb server version doesn't match this client"* error.

Pick **one**:
- Preferred: add to your **user** PATH `D:\Android\Sdk\platform-tools` and `D:\Android\Sdk\emulator` **above** the `tool-kit` entry, then run `adb kill-server`.
- Or delete/rename the standalone `tool-kit\platform-tools` after the SDK is installed.

Verify (new terminal): `Get-Command adb -All` → the first result should be under `D:\Android\Sdk`.

## 6. Physical Android device  (required for Phase 1)
I need a **real device** for the RTL/bidi/date-picker spike and for push notifications later (Google Play services images on emulators are less reliable for push).

1. Phone: Settings → About phone → tap **Build number** 7 times → enable **Developer options**.
2. Developer options → enable **USB debugging** (and *Install via USB* if it appears).
3. Connect by USB, accept the "Allow USB debugging?" prompt on the phone, then:
```powershell
adb devices      # your device must say "device" (not "unauthorized")
```
4. Tell me the device model and Android version — this becomes your baseline test device.
5. For Arabic/RTL testing: Android 13+ lets you set **per-app language** (Settings → Apps → app → Language); on older versions we switch the phone's system language.

A second device (or an emulator) with a different language is ideal for the two-account tests later, but not needed yet.

## 7. Emulator (optional but useful) and virtualization
- Check virtualization: **Task Manager → Performance → CPU → "Virtualization: Enabled"**. If disabled, enable Intel VT-x / AMD-V (SVM) in BIOS/UEFI.
- Windows features (admin): enable **Windows Hypervisor Platform** and **Virtual Machine Platform** (Settings → Optional features → More Windows features, or `Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform, VirtualMachinePlatform`), then reboot.
- Android Studio → **Device Manager → Create device** → a Pixel, system image **"Google Play" x86_64** (needed if you want Google sign-in/push on the emulator).

## 8. Docker Desktop — install later (Phase 2)
Needed for `supabase start` (local Postgres) and running **pgTAP security tests** locally. Not required for Phase 1.
- Windows 11 Home works with the **WSL 2 backend**: `wsl --install` (admin, reboot), then `winget install Docker.DockerDesktop`.
- Skip for now unless you want everything ready.

## 9. Supabase CLI — install later (Phase 1/2)
Not installed globally. It is **not** supported via `npm install -g`; we'll add it as a **project dev dependency** (`npx supabase …`) or via Scoop. I'll handle this when we reach it.

## 10. Accounts

| Account | Needed by | Do now? | Notes |
|---|---|---|---|
| **Expo / EAS** | Phase 1 | ✅ done | `eas whoami` works |
| **GitHub** (private repo) | Phase 0/1 | Yes | Backup + CI. Create an empty private repo (no README) named e.g. `letterapp` |
| **Supabase** | Phase 2 | Create now | New organization + project. Choose a region close to your users (OPEN-7). Save the DB password in a password manager. **Never paste keys into chat.** |
| **Google Cloud Console** | Phase 2 (Google Sign-In) | Later | OAuth consent screen + Android/Web client IDs. Android client needs the **package name + SHA-1** → after Phase 1 fixes the dev package ID |
| **Firebase** (FCM credentials for push) | Phase 7 | Later | Tied to the package ID → create after the dev ID is fixed (and again for production after the naming freeze) |
| **Google Play Console** | Phase 10 | Later | One-time fee; identity verification takes time. New personal developer accounts may require a **closed test with a minimum number of testers for a minimum number of days** before production — I'll check current rules before Phase 10 |
| Domain for invite links | Naming freeze | Later | Not now (DEC-012) |

## 11. VS Code extensions (optional but recommended)
ESLint · Prettier · Expo Tools · EditorConfig · (for Arabic text) make sure the editor font renders Arabic properly.

## 12. Repository setup — waiting for your go-ahead
Not done yet (no changes made without approval). When you approve, I will:
1. `git init` in `D:\dev\tab\letters` (branch `main`).
2. Add `.gitignore` (node_modules, `.env*`, `.expo`, `android/`, `ios/`, build outputs, EAS artifacts, keystores `*.jks`, Supabase `.branches`/`.temp`) and `.gitattributes` (`* text=auto eol=lf`).
3. Commit `CLAUDE.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/PHASE0_CHECKLIST.md`.
4. Connect the GitHub remote you create.

## 13. Security hygiene (set habits now)
- Password manager for Supabase DB password, Expo, Google, GitHub. Turn on **2FA** on GitHub, Expo, Google, Supabase.
- Secrets live in `.env` (git-ignored), EAS secrets, or Supabase secrets — never in code or chat.
- The Supabase **anon** key is designed to be public; the **service_role** key is never put in the app.
- Android release **keystore**: EAS manages it; do not lose or commit any local keystore.

---

## 14. Verification script (run when steps 2–6 are done)
```powershell
node -v; npm -v; git --version
java -version
$env:ANDROID_HOME; $env:JAVA_HOME
adb version; adb devices
Get-Command adb -All | Select-Object -ExpandProperty Source
eas --version; eas whoami
Test-Path D:\Android\Sdk\emulator\emulator.exe
```
Paste the output and I'll confirm each item.

## 15. Phase 0 exit criteria
- [ ] Node is an **even-numbered LTS**
- [ ] Git identity configured
- [ ] Android SDK installed at `D:\Android\Sdk` (platform, build-tools, platform-tools, cmdline-tools)
- [ ] Exactly one `adb` first on PATH
- [ ] A physical Android device shows as `device` in `adb devices`
- [ ] Supabase and GitHub accounts created (with 2FA)
- [x] Dev package ID chosen: `com.letterapp.dev` (OPEN-3 resolved; dev-only)  *(DEC-007 is accepted — no longer blocking)*
- [ ] Repo initialized and planning docs committed (after your approval)

When these are ticked, Phase 1 (Foundation + i18n/RTL spike) can start — only after you say go.
