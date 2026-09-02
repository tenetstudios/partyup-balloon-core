# @partyup/balloon-core

Canonical, headless TypeScript rules for PartyUp Balloon Rooms through Phase 6.

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

Phase 6 adds a deterministic five-round environmental scheduler shared by both
clients. Wave balloons carry explicit `wave` source metadata, bypass player
economy and launch queues, and are delivered to both rooms through reproducible
lanes. Speed and Heavy Balloons use the same movement, pathfinding, nails,
manual-pop, and ceiling lifecycle as Basic Balloons, with centralized type
configuration. Completing Round 3 unlocks Speed purchases; completing Round 4
unlocks Heavy purchases. A ten-second build countdown runs before Round 1 and
between every later round. PvP queues remain active during waves and transitions.

Phase 6.2 expands the wall budget to 24 segments and continues PvE indefinitely
after the five introductory rounds through a deterministic scaling function.
Nail strips can stack on one wall and atomically trade their durability for
balloon HP in oldest-first order. Persistent Glue traps cost 40 Coins and apply
one permanent 0.65 speed multiplier without influencing pathfinding. Glue and
Nails may coexist on the same wall.
