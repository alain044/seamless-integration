# Nova memory

Durable facts Nova is told to remember. One per line. Edit or delete freely — this file is the
record, not a cache of one.
- [lesson] In this project's Windows workspace, run the test suite with `node node_modules/vitest/vitest.mjs run` — `node_modules\.bin\vitest.cmd` fails with "spawn EINVAL", and `tail`/`rg` are not installed.
- [convention] All eight locale files in src/i18n/locales must define exactly the same key set as en.ts (including {{placeholders}}) — i18next silently falls back to English otherwise, and src/test/i18n-consistency.test.ts enforces parity.
- [lesson] Keep src/lib/securityLog.ts imported only via dynamic import() (as AuthPage and AdminGuard now do); a static import pins it into the main bundle and makes Vite warn that the lazy chunk cannot be split.
