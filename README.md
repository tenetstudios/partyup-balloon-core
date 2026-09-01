# @partyup/balloon-core

Canonical, headless TypeScript rules for PartyUp Balloon Rooms through Phase 5.

The package owns logical state, constants, movement, route finding, wall validation,
nail contact, and typed player actions. It intentionally has no React, browser,
React Native, Expo, Next.js, storage, networking, or Supabase dependencies.

Nail strips deal their final point of damage at 1/10 durability and are then
removed automatically at 0/10, immediately returning that inventory slot.

Phase 4 adds the transport-friendly `SEND_BALLOON` action. Callers provide an
explicit match, sender, target room, lane, sequence, and send time; the core
derives a stable balloon ID, validates the action, and spawns the existing Basic
Balloon at the canonical lane entry before normal pathfinding takes over.

Phase 5 adds canonical per-room Coins, Income, deterministic recurring income
ticks, costed wall/nail placement, and atomic cost-plus-Income Basic Balloon
purchases. Phase 5.1 slows the economy and adds a FIFO offensive launch queue:
`SEND_BALLOON` commits the purchase without spawning, while
`APPLY_LAUNCH_QUEUE` deploys at most one due entry using canonical simulation
time and 600 ms spacing. Removals, breakage, and queued purchases never refund
Coins.

Both PartyUp clients consume an immutable Git commit of this repository so their
rules cannot drift. Rendering, animation timing, and pointer/touch hit testing stay
inside the clients.

```sh
npm ci
npm test
```

Networking and server authority remain explicitly out of scope.
