# Manual screen-reader acceptance

Automated WCAG checks are a regression floor, not a substitute for listening to the product. Run this checklist before each release candidate in both English and Bangla.

## Test matrix

| Platform | Screen reader | Browser | Viewport |
| --- | --- | --- | --- |
| Windows | NVDA (current) | Firefox | Desktop and 320 CSS px |
| macOS | VoiceOver | Safari | Desktop and 320 CSS px |
| iOS | VoiceOver | Safari | Native device |
| Android | TalkBack | Chrome | Native device |

Record the operating-system, screen-reader, and browser versions with the release evidence. A pass from a simulator does not replace the iOS and Android device rows.

## Required journeys

1. Signed out: use the skip link, read the landing-page heading structure, open sign-in, recover a password, and reach the branded not-found page.
2. Dashboard: sign in, traverse the sidebar and mobile drawer, create and correct a transaction, attach a receipt, filter reports, and use notifications.
3. Planning: create and remove a budget, goal, debt term, recurring rule, and tag. Confirm every mutation result is announced once.
4. Settings: change language and theme, inspect sessions and mobile pairing, and navigate the notification preferences.
5. Operator: complete the MFA gate; review users, audit events, monitoring, jobs, performance, alerts, notification delivery/templates, security pages, releases, and Site Settings.
6. Site Settings: choose a valid logo, edit every labelled payment field, remove a method, save, and confirm both success and validation failures are announced.

## Pass criteria

- Landmarks, headings, tables, lists, and form groups convey the visual structure without guessing.
- Focus order follows reading order; focus is always visible and returns to the initiating control after transient UI closes.
- Every control has a concise unique name, including icon-only and destructive controls.
- Instructions, validation errors, loading states, and saved/failed outcomes are announced without moving focus unexpectedly.
- Content remains complete at 200% text zoom and at 320 CSS pixels with no two-dimensional page scrolling.
- English and Bangla are pronounced using the correct document language and neither language clips or truncates meaningful text.
- No journey depends on colour, pointer hover, drag gestures, animation, or sound alone.

Any failure blocks release. Link the issue and retest evidence in the release checklist after remediation.
