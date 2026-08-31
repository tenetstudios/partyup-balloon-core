# @partyup/balloon-core

Canonical, headless TypeScript rules for PartyUp Balloon Rooms through Phase 3.

The package owns logical state, constants, movement, route finding, wall validation,
nail contact, and typed player actions. It intentionally has no React, browser,
React Native, Expo, Next.js, storage, networking, or Supabase dependencies.

Both PartyUp clients consume an immutable Git commit of this repository so their
rules cannot drift. Rendering, animation timing, and pointer/touch hit testing stay
inside the clients.

```sh
npm ci
npm test
```

Phase 4 gameplay and multiplayer are explicitly out of scope.
