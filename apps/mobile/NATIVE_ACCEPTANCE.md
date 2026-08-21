# Native acceptance

NoorixFin's mobile release gate uses installed Android APK and iOS simulator
artifacts, not Expo Go. This matters because SQLCipher is compiled into the
native application and is unavailable in Expo Go.

## Automated gate

The `e2e-test` EAS profile builds an unsigned internal APK and iOS simulator
application. The two EAS workflows build each platform and run every Maestro
flow under `.maestro/`:

- clean launch reaches sign-in only after the SQLCipher database opens;
- an invalid pairing deep link cannot bypass authentication;
- an authenticated session and selected workspace survive an offline process
  kill/relaunch;
- the offline state is visible and the notifications deep link resolves;
- notification permissions are exercised on a native installation.

Configure `MAESTRO_TEST_EMAIL`, `MAESTRO_TEST_PASSWORD`,
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` in the EAS `preview` environment. The test user
must own one seeded workspace. Run both workflows before changing mobile
release metadata from preview to live:

```bash
cd apps/mobile
eas workflow:run .eas/workflows/e2e-android.yml
eas workflow:run .eas/workflows/e2e-ios.yml
```

Attach the two workflow URLs and installed-build versions to the GitHub release.
The release is blocked if either flow, the unit suite, or the multi-platform
Expo export fails.

## Manual assistive-technology check

On the same candidate builds, record one pass with Android TalkBack and one with
iOS VoiceOver: unlock, create and reverse a transaction, repair a rejected
offline change, change English/Bangla, export/share JSON, and revoke a session.
Verify focus order, selected/disabled states, 200% system text, and that no
financial value is communicated by colour alone.
