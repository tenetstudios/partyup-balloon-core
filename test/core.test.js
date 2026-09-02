import assert from "node:assert/strict";
import test from "node:test";
import {
  BASIC_BALLOON_COST,
  BASIC_BALLOON_HP,
  BASIC_BALLOON_INCOME_GAIN,
  BASIC_BALLOON_LAUNCH_INTERVAL_MS,
  BASIC_BALLOON_ROOM_DAMAGE,
  BALLOON_TYPES,
  ENTRY_LANES,
  HEAVY_BALLOON_COST,
  HEAVY_BALLOON_HP,
  HEAVY_BALLOON_INCOME_GAIN,
  HEAVY_BALLOON_ROOM_DAMAGE,
  HEAVY_BALLOON_SPEED_MULTIPLIER,
  GLUE_COST,
  GLUE_SPEED_MULTIPLIER,
  HEAVY_DIRECT_STRUCTURAL_DAMAGE,
  HEAVY_GLANCING_STRUCTURAL_DAMAGE,
  HORIZONTAL_WALL_COST,
  INCOME_TICK_INTERVAL_MS,
  MAX_NAIL_STRIPS,
  MAX_WALL_SEGMENTS,
  WALL_MAX_INTEGRITY,
  MAX_LAUNCH_QUEUE_SIZE,
  NAIL_STRIP_COST,
  NAIL_MAX_DURABILITY,
  PRE_ROUND_COUNTDOWN_MS,
  ROOM_MAX_HEALTH,
  ROUND_TRANSITION_MS,
  SPEED_BALLOON_COST,
  SPEED_BALLOON_HP,
  SPEED_BALLOON_INCOME_GAIN,
  SPEED_BALLOON_ROOM_DAMAGE,
  SPEED_BALLOON_SPEED_MULTIPLIER,
  STARTING_COINS,
  STARTING_INCOME,
  VERTICAL_WALL_COST,
  WAVE_BALLOON_SPAWN_INTERVAL_MS,
  WAVE_ROUNDS,
  applyGameAction,
  classifyStructuralImpact,
  createBalloonRoom,
  createBasicBalloon,
  createBalloon,
  createSendBalloonAction,
  createWaveState,
  createWallSegment,
  damageBalloon,
  damageWallStructure,
  findPathToCeiling,
  getCellCenter,
  getLaneCell,
  getWaveRound,
  getUnsupportedHorizontalWalls,
  hasRequiredRoutes,
  isTraversalBlocked,
  placeNailStrip,
  placeGlueTrap,
  placeWall,
  recalculateBalloonPath,
  removeNailStrip,
  updateBalloonPosition,
  updateRoomSimulation,
  updateWaveState,
  validateWallPlacement,
} from "../dist/index.js";

function resolveStartingContact(room, balloon) {
  room.balloons.push(balloon);
  return updateBalloonPosition(room, balloon, 0.001);
}

const wall = (room, orientation, gridX, gridY) => createWallSegment(room.id, orientation, gridX, gridY);

function armedContactRoom(id, durability = NAIL_MAX_DURABILITY) {
  const room = createBalloonRoom(id);
  const armedWall = wall(room, "vertical", 3, 8);
  assert.equal(placeWall(room, armedWall).valid, true);
  assert.equal(placeNailStrip(room, armedWall.id).valid, true);
  room.nailStrips[0].durability = durability;
  return room;
}

function sendAction(room, lane, senderSequence, overrides = {}) {
  return {
    ...createSendBalloonAction({
      matchId: "phase-4-match",
      senderId: "attacker",
      targetRoomId: room.id,
      lane,
      senderSequence,
      sentAt: senderSequence * 1000,
    }),
    ...overrides,
  };
}

function applySend(targetRoom, action, senderRoom = createBalloonRoom(`sender-${action.senderSequence}`)) {
  return applyGameAction(senderRoom, action, targetRoom);
}

function applyLaunch(senderRoom, targetRoom, simulationTimeMs) {
  return applyGameAction(senderRoom, { type: "APPLY_LAUNCH_QUEUE", simulationTimeMs }, targetRoom);
}

test("basic balloon uses canonical HP", () => {
  assert.equal(createBasicBalloon("room", "balloon", 1).health, BASIC_BALLOON_HP);
});

test("manual pop action deals exactly one damage", () => {
  const room = createBalloonRoom("manual");
  const balloon = createBasicBalloon(room.id, "balloon", 1);
  room.balloons.push(balloon);
  const result = applyGameAction(room, { type: "POP_BALLOON", balloonId: balloon.id });
  assert.equal(result.applied, true);
  assert.equal(balloon.health, BASIC_BALLOON_HP - 1);
});

test("ceiling escape applies canonical room damage once", () => {
  const room = createBalloonRoom("escape");
  const balloon = createBasicBalloon(room.id, "balloon", 1);
  room.balloons.push(balloon);
  const events = updateRoomSimulation(room, 20);
  assert.equal(room.health, ROOM_MAX_HEALTH - BASIC_BALLOON_ROOM_DAMAGE);
  assert.equal(events.filter((event) => event.type === "balloon_escaped").length, 1);
});

test("all four entry lanes map to distinct canonical cells", () => {
  assert.deepEqual(ENTRY_LANES, [1, 2, 3, 4]);
  assert.deepEqual(ENTRY_LANES.map((lane) => getLaneCell(lane).column), [0, 2, 3, 5]);
});

test("one SEND_BALLOON action queues exactly one purchase and the scheduler launches it", () => {
  const room = createBalloonRoom("single-send");
  const sender = createBalloonRoom("single-sender");
  const result = applySend(room, sendAction(room, 3, 1), sender);
  assert.equal(result.applied, true);
  assert.equal(room.balloons.length, 0);
  assert.equal(sender.attack.queue.length, 1);
  assert.equal(result.queuedBalloon, sender.attack.queue[0]);
  const launch = applyLaunch(sender, room, 0);
  assert.equal(launch.applied, true);
  assert.equal(launch.launchedBalloon, room.balloons[0]);
  assert.equal(room.balloons[0].spawnLane, 3);
  assert.equal(room.balloons[0].health, BASIC_BALLOON_HP);
  assert.deepEqual(room.balloons[0].currentCell, getLaneCell(3));
});

test("rapid sends queue without instant stacking and launch at canonical spacing", () => {
  const room = createBalloonRoom("repeat-send");
  const sender = createBalloonRoom("repeat-sender");
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    assert.equal(applySend(room, sendAction(room, 4, sequence), sender).applied, true);
  }
  assert.equal(sender.attack.queue.length, 4);
  assert.equal(room.balloons.length, 0);
  assert.ok(applyLaunch(sender, room, 0).launchedBalloon);
  assert.equal(applyLaunch(sender, room, BASIC_BALLOON_LAUNCH_INTERVAL_MS - 1).launchedBalloon, undefined);
  assert.ok(applyLaunch(sender, room, BASIC_BALLOON_LAUNCH_INTERVAL_MS).launchedBalloon);
  assert.ok(applyLaunch(sender, room, BASIC_BALLOON_LAUNCH_INTERVAL_MS * 2).launchedBalloon);
  assert.ok(applyLaunch(sender, room, BASIC_BALLOON_LAUNCH_INTERVAL_MS * 3).launchedBalloon);
  assert.equal(room.balloons.length, 4);
  assert.deepEqual(room.balloons.map((balloon) => balloon.spawnLane), [4, 4, 4, 4]);
  assert.equal(new Set(room.balloons.map((balloon) => balloon.id)).size, 4);
});

test("queue preserves FIFO lane order and locks lane at purchase", () => {
  const room = createBalloonRoom("change-lane");
  const sender = createBalloonRoom("change-sender");
  applySend(room, sendAction(room, 4, 1), sender);
  applySend(room, sendAction(room, 1, 2), sender);
  applySend(room, sendAction(room, 3, 3), sender);
  assert.deepEqual(sender.attack.queue.map((queued) => queued.lane), [4, 1, 3]);
  for (const time of [0, 600, 1200]) applyLaunch(sender, room, time);
  assert.deepEqual(room.balloons.map((balloon) => balloon.spawnLane), [4, 1, 3]);
});

test("send identity is deterministic and duplicate delivery is rejected", () => {
  const room = createBalloonRoom("identity");
  const first = sendAction(room, 2, 8);
  const replay = sendAction(room, 2, 8);
  const sender = createBalloonRoom("identity-sender");
  assert.equal(first.balloonId, replay.balloonId);
  assert.equal(applySend(room, first, sender).applied, true);
  const duplicate = applySend(room, replay, sender);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.code, "duplicate_balloon_id");
  assert.equal(sender.attack.queue.length, 1);
  assert.equal(room.balloons.length, 0);
});

test("duplicate delivery remains rejected after the original balloon leaves active state", () => {
  const room = createBalloonRoom("identity-after-pop");
  const action = sendAction(room, 2, 9);
  const sender = createBalloonRoom("identity-after-pop-sender");
  assert.equal(applySend(room, action, sender).applied, true);
  applyLaunch(sender, room, 0);
  const balloon = room.balloons[0];
  balloon.health = 1;
  assert.equal(applyGameAction(room, { type: "POP_BALLOON", balloonId: balloon.id }).applied, true);
  assert.equal(room.balloons.length, 0);
  assert.equal(applySend(room, action, sender).code, "duplicate_balloon_id");
  assert.equal(room.balloons.length, 0);
});

test("invalid send lane, target, type, identity, metadata, and room state are rejected", () => {
  const room = createBalloonRoom("invalid-send");
  const sender = createBalloonRoom("invalid-sender");
  assert.equal(applySend(room, sendAction(room, 0, 1), sender).code, "invalid_lane");
  assert.equal(applySend(room, sendAction(room, 1, 2, { targetRoomId: "missing" }), sender).code, "target_not_found");
  assert.equal(applySend(room, sendAction(room, 1, 3, { balloonType: "unknown" }), sender).code, "invalid_balloon_type");
  const lockedHeavy = createSendBalloonAction({ matchId: "phase-4-match", senderId: "attacker", targetRoomId: room.id, lane: 1, senderSequence: 30, sentAt: 30000, balloonType: "heavy" });
  assert.equal(applySend(room, lockedHeavy, sender).code, "balloon_locked");
  assert.equal(applySend(room, sendAction(room, 1, 4, { balloonId: "forged" }), sender).code, "invalid_identity");
  assert.equal(applySend(room, sendAction(room, 1, 0), sender).code, "invalid_metadata");
  room.health = 0;
  assert.equal(applySend(room, sendAction(room, 1, 5), sender).code, "room_closed");
  assert.equal(room.balloons.length, 0);
});

test("a launched balloon uses the target room pathfinding", () => {
  const room = createBalloonRoom("send-route");
  const sender = createBalloonRoom("send-route-sender");
  placeWall(room, wall(room, "vertical", 3, 5));
  placeWall(room, wall(room, "horizontal", 2, 5));
  assert.equal(applySend(room, sendAction(room, 2, 1), sender).applied, true);
  const result = applyLaunch(sender, room, 0);
  assert.ok(result.launchedBalloon.path.some((cell) => cell.column === 1));
});

test("a launched balloon resolves consecutive nail damage through normal simulation", () => {
  const room = armedContactRoom("sent-nails");
  const sender = createBalloonRoom("sent-nails-sender");
  assert.equal(applySend(room, sendAction(room, 2, 1), sender).applied, true);
  const result = applyLaunch(sender, room, 0);
  const events = updateRoomSimulation(room, 4).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 1);
  assert.equal(result.launchedBalloon.health, 0);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - BASIC_BALLOON_HP);
});

test("a wall blocks its represented grid edge", () => {
  const room = createBalloonRoom("edge");
  const segment = wall(room, "vertical", 3, 5);
  assert.equal(isTraversalBlocked({ column: 2, row: 5 }, { column: 3, row: 5 }, [segment]), true);
  assert.equal(isTraversalBlocked({ column: 2, row: 4 }, { column: 3, row: 4 }, [segment]), false);
});

test("a supported horizontal span succeeds", () => {
  const room = createBalloonRoom("supported");
  assert.equal(placeWall(room, wall(room, "vertical", 3, 5)).valid, true);
  assert.equal(placeWall(room, wall(room, "horizontal", 2, 5)).valid, true);
  assert.equal(placeWall(room, wall(room, "horizontal", 3, 5)).valid, true);
  assert.equal(getUnsupportedHorizontalWalls(room.walls).length, 0);
});

test("an unsupported span fails", () => {
  const room = createBalloonRoom("unsupported");
  placeWall(room, wall(room, "vertical", 1, 5));
  placeWall(room, wall(room, "horizontal", 1, 5));
  placeWall(room, wall(room, "horizontal", 2, 5));
  assert.equal(validateWallPlacement(room, wall(room, "horizontal", 3, 5)).code, "needs_support");
});

test("a complete lane seal fails", () => {
  const room = createBalloonRoom("seal");
  placeWall(room, wall(room, "vertical", 1, 4));
  placeWall(room, wall(room, "vertical", 5, 4));
  for (const gridX of [0, 1, 2, 5, 4]) assert.equal(placeWall(room, wall(room, "horizontal", gridX, 5)).valid, true);
  assert.equal(validateWallPlacement(room, wall(room, "horizontal", 3, 5)).code, "path_required");
  assert.equal(hasRequiredRoutes(room, room.walls), true);
});

test("pathfinding routes around walls with deterministic bias", () => {
  const room = createBalloonRoom("route");
  placeWall(room, wall(room, "vertical", 3, 5));
  placeWall(room, wall(room, "horizontal", 2, 5));
  const path = findPathToCeiling(getLaneCell(2), room.walls, "left");
  assert.ok(path?.some((cell) => cell.column === 1));
});

test("nails never influence pathfinding", () => {
  const room = armedContactRoom("path-nails");
  const before = findPathToCeiling(getLaneCell(2), room.walls, "left");
  removeNailStrip(room, room.walls[0].id);
  const after = findPathToCeiling(getLaneCell(2), room.walls, "left");
  assert.deepEqual(after, before);
});

test("one valid nail contact atomically spends durability against all remaining HP", () => {
  const room = armedContactRoom("contact");
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  room.balloons.push(balloon);
  const events = updateRoomSimulation(room, 1).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 1);
  assert.equal(balloon.health, 0);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - BASIC_BALLOON_HP);
});

test("continuous contact does not repeatedly damage", () => {
  const room = armedContactRoom("continuous");
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  room.balloons.push(balloon);
  updateRoomSimulation(room, 1);
  const laterEvents = updateRoomSimulation(room, 0.25);
  assert.equal(balloon.health, 0);
  assert.equal(laterEvents.filter((event) => event.type === "nail_contact").length, 0);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - BASIC_BALLOON_HP);
});

test("low nail durability is exhausted atomically while a Heavy survives", () => {
  const room = armedContactRoom("low-durability", 4);
  const balloon = createBalloon(room.id, "heavy", "heavy", 2);
  room.balloons.push(balloon);
  const events = updateRoomSimulation(room, 4).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 1);
  assert.equal(balloon.health, HEAVY_BALLOON_HP - 4);
  assert.equal(room.nailStrips.length, 0);
});

test("nails are automatically removed at zero durability", () => {
  const room = armedContactRoom("break", 1);
  const breaker = createBasicBalloon(room.id, "breaker", 2);
  room.balloons.push(breaker);
  updateRoomSimulation(room, 1);
  assert.equal(room.nailStrips.length, 0);
  const next = createBasicBalloon(room.id, "next", 2);
  room.balloons.push(next);
  updateRoomSimulation(room, 1);
  assert.equal(next.health, BASIC_BALLOON_HP);
});

test("exhausted nails leave the wall intact and free inventory", () => {
  const room = armedContactRoom("wall-after-break", 1);
  const armedWallId = room.walls[0].id;
  room.balloons.push(createBasicBalloon(room.id, "breaker", 2));
  updateRoomSimulation(room, 1);
  assert.equal(room.walls.length, 1);
  assert.equal(room.nailStrips.length, 0);
  assert.equal(placeNailStrip(room, armedWallId).valid, true);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY);
});

test("nail removal preserves the wall and repositioning restores durability", () => {
  const room = armedContactRoom("remove", 2);
  const wallId = room.walls[0].id;
  assert.equal(removeNailStrip(room, wallId).valid, true);
  assert.equal(room.walls.length, 1);
  placeNailStrip(room, wallId);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY);
  assert.equal(room.nailStrips[0].status, "active");
});

test("REMOVE_WALL removes one oldest nail strip before the wall", () => {
  const room = armedContactRoom("remove-action");
  const wallId = room.walls[0].id;
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: wallId }).message, "One Nail Strip removed; wall remains");
  assert.equal(room.walls.length, 1);
  assert.equal(room.nailStrips.length, 0);
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: wallId }).applied, true);
  assert.equal(room.walls.length, 0);
});

test("nail inventory is limited to four strips", () => {
  const room = createBalloonRoom("inventory");
  for (let row = 0; row <= MAX_NAIL_STRIPS; row += 1) placeWall(room, wall(room, "vertical", 1, row));
  for (const segment of room.walls.slice(0, MAX_NAIL_STRIPS)) assert.equal(placeNailStrip(room, segment.id).valid, true);
  assert.equal(placeNailStrip(room, room.walls[MAX_NAIL_STRIPS].id).code, "limit_reached");
});

test("wall inventory allows 24 legal segments and rejects the 25th", () => {
  assert.equal(MAX_WALL_SEGMENTS, 24);
  const room = createBalloonRoom("wall-capacity");
  const candidates = [];
  for (let gridX = 1; gridX <= 5; gridX += 1) {
    for (let gridY = 0; gridY < 10; gridY += 1) candidates.push(wall(room, "vertical", gridX, gridY));
  }
  for (const segment of candidates.slice(0, MAX_WALL_SEGMENTS)) assert.equal(placeWall(room, segment).valid, true);
  assert.equal(room.walls.length, 24);
  assert.equal(placeWall(room, candidates[MAX_WALL_SEGMENTS]).code, "budget_reached");
});

test("stacked nails preserve identity and consume oldest durability first", () => {
  const room = armedContactRoom("stacked-nails");
  const wallId = room.walls[0].id;
  assert.equal(placeNailStrip(room, wallId).valid, true);
  assert.equal(placeNailStrip(room, wallId).valid, true);
  assert.equal(new Set(room.nailStrips.map((nail) => nail.id)).size, 3);
  const balloon = createBalloon(room.id, "twenty-five-hp", "heavy", 2);
  balloon.health = 25;
  balloon.maxHealth = 25;
  room.balloons.push(balloon);
  const contacts = updateRoomSimulation(room, 4).filter((event) => event.type === "nail_contact");
  assert.equal(contacts.length, 3);
  assert.equal(balloon.health, 0);
  assert.equal(room.nailStrips.length, 1);
  assert.equal(room.nailStrips[0].durability, 5);
  assert.match(room.nailStrips[0].id, /:3$/);
});

test("Glue permanently applies 65 percent canonical speed only once to every balloon type", () => {
  assert.equal(GLUE_SPEED_MULTIPLIER, 0.65);
  for (const balloonType of ["basic", "speed", "heavy"]) {
    const room = createBalloonRoom(`glue-${balloonType}`);
    const segment = wall(room, "vertical", 3, 8);
    placeWall(room, segment);
    placeGlueTrap(room, segment.id);
    const balloon = createBalloon(room.id, `glued-${balloonType}`, balloonType, 2);
    room.balloons.push(balloon);
    const first = updateRoomSimulation(room, 4).filter((event) => event.type === "glue_contact");
    assert.equal(first.length, 1);
    assert.equal(balloon.glued, true);
    assert.equal(balloon.speed, BALLOON_TYPES[balloonType].speed * GLUE_SPEED_MULTIPLIER);
    const slowedSpeed = balloon.speed;
    const repeat = updateRoomSimulation(room, 1).filter((event) => event.type === "glue_contact");
    assert.equal(repeat.length, 0);
    assert.equal(balloon.speed, slowedSpeed);
  }
});

test("Glue and stacked Nails coexist on one wall and resolve slow before damage", () => {
  const room = armedContactRoom("glue-and-nails");
  const wallId = room.walls[0].id;
  placeNailStrip(room, wallId);
  placeGlueTrap(room, wallId);
  const balloon = createBalloon(room.id, "glued-heavy", "heavy", 2);
  room.balloons.push(balloon);
  const events = updateRoomSimulation(room, 4);
  assert.equal(events[0].type, "glue_contact");
  assert.equal(events.filter((event) => event.type === "nail_contact").length, 1);
  assert.equal(balloon.glued, true);
  assert.equal(balloon.health, 0);
  assert.equal(room.glueTraps.length, 1);
  assert.equal(room.nailStrips.length, 1);
});

test("Glue costs 40 Coins and explicit removal preserves nails and wall", () => {
  assert.equal(GLUE_COST, 40);
  const room = createBalloonRoom("glue-actions");
  const segment = wall(room, "vertical", 3, 8);
  placeWall(room, segment);
  placeNailStrip(room, segment.id);
  const before = room.economy.coins;
  assert.equal(applyGameAction(room, { type: "PLACE_GLUE", wallSegmentId: segment.id }).applied, true);
  assert.equal(room.economy.coins, before - GLUE_COST);
  assert.equal(applyGameAction(room, { type: "REMOVE_GLUE", wallSegmentId: segment.id }).applied, true);
  assert.equal(room.walls.length, 1);
  assert.equal(room.nailStrips.length, 1);
  assert.equal(room.economy.coins, before - GLUE_COST);
});

test("a balloon killed by nails cannot damage room health", () => {
  const room = armedContactRoom("nail-kill");
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  balloon.health = 1;
  room.balloons.push(balloon);
  const before = room.health;
  updateRoomSimulation(room, 1);
  updateRoomSimulation(room, 20);
  assert.equal(room.health, before);
  assert.equal(room.balloons.length, 0);
});

test("horizontal walls accept nails and use logical cell contact", () => {
  const room = createBalloonRoom("horizontal-nails");
  placeWall(room, wall(room, "vertical", 3, 8));
  const armed = wall(room, "horizontal", 2, 9);
  placeWall(room, armed);
  placeNailStrip(room, armed.id);
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  const start = getCellCenter({ column: 1, row: 9 });
  Object.assign(balloon, { x: start.x, y: start.y, currentCell: { column: 1, row: 9 }, targetCell: { column: 2, row: 9 }, pathRevision: room.wallRevision });
  room.balloons.push(balloon);
  assert.equal(updateBalloonPosition(room, balloon, 2).filter((event) => event.type === "nail_contact").length, 1);
  assert.equal(balloon.health, 0);
});

test("direct damage API still deals exactly one by default", () => {
  const room = createBalloonRoom("damage");
  const balloon = createBasicBalloon(room.id, "balloon", 4);
  room.balloons.push(balloon);
  assert.deepEqual(damageBalloon(room, balloon.id), { balloonId: balloon.id, remainingHealth: 2, popped: false });
});

test("Phase 5.1 economy starts with slower canonical coins, income, and next tick", () => {
  const room = createBalloonRoom("economy-start");
  assert.equal(STARTING_COINS, 300);
  assert.equal(STARTING_INCOME, 30);
  assert.equal(INCOME_TICK_INTERVAL_MS, 8000);
  assert.equal(BASIC_BALLOON_INCOME_GAIN, 3);
  assert.equal(MAX_LAUNCH_QUEUE_SIZE, 10);
  assert.equal(BASIC_BALLOON_LAUNCH_INTERVAL_MS, 600);
  assert.deepEqual(room.economy, {
    coins: STARTING_COINS,
    income: STARTING_INCOME,
    nextIncomeTickAt: INCOME_TICK_INTERVAL_MS,
  });
});

test("income ticks use deterministic simulation time and catch up exactly", () => {
  const room = createBalloonRoom("income-ticks");
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 7999 }).incomeTicksApplied, 0);
  assert.equal(room.economy.coins, 300);
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 8000 }).incomeTicksApplied, 1);
  assert.equal(room.economy.coins, 330);
  assert.equal(room.economy.nextIncomeTickAt, 16000);
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 24000 }).incomeTicksApplied, 2);
  assert.equal(room.economy.coins, 390);
  assert.equal(room.economy.nextIncomeTickAt, 32000);
});

test("successful purchases cost coins, grow income, and queue without spawning", () => {
  const sender = createBalloonRoom("economy-sender");
  const target = createBalloonRoom("economy-target");
  sender.economy.coins = 200;
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    assert.equal(applyGameAction(sender, sendAction(target, 3, sequence), target).applied, true);
  }
  assert.equal(sender.economy.coins, 200 - 4 * BASIC_BALLOON_COST);
  assert.equal(sender.economy.income, STARTING_INCOME + 4 * BASIC_BALLOON_INCOME_GAIN);
  assert.equal(sender.attack.queue.length, 4);
  assert.equal(target.balloons.length, 0);
});

test("four purchases from 100 coins commit exactly and compound on the future tick", () => {
  const sender = createBalloonRoom("exact-purchase-sender");
  const target = createBalloonRoom("exact-purchase-target");
  sender.economy.coins = 100;
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    assert.equal(applyGameAction(sender, sendAction(target, 1, sequence), target).applied, true);
  }
  assert.equal(sender.economy.coins, 0);
  assert.equal(sender.economy.income, 42);
  assert.equal(sender.attack.queue.length, 4);
  assert.equal(applyGameAction(sender, sendAction(target, 1, 5), target).code, "insufficient_coins");
  applyGameAction(sender, { type: "APPLY_INCOME_TICK", simulationTimeMs: INCOME_TICK_INTERVAL_MS });
  assert.equal(sender.economy.coins, 42);
});

test("insufficient send is atomic and never creates a balloon", () => {
  const sender = createBalloonRoom("poor-sender");
  const target = createBalloonRoom("poor-target");
  sender.economy.coins = BASIC_BALLOON_COST - 5;
  const result = applyGameAction(sender, sendAction(target, 2, 1), target);
  assert.equal(result.code, "insufficient_coins");
  assert.equal(sender.economy.coins, 20);
  assert.equal(sender.economy.income, STARTING_INCOME);
  assert.equal(sender.attack.queue.length, 0);
  assert.equal(target.balloons.length, 0);
});

test("a full launch queue rejects purchases atomically", () => {
  const sender = createBalloonRoom("full-queue-sender");
  const target = createBalloonRoom("full-queue-target");
  sender.economy.coins = 1000;
  for (let sequence = 1; sequence <= MAX_LAUNCH_QUEUE_SIZE; sequence += 1) {
    assert.equal(applySend(target, sendAction(target, (sequence % 4) + 1, sequence), sender).applied, true);
  }
  const coinsBefore = sender.economy.coins;
  const incomeBefore = sender.economy.income;
  const result = applySend(target, sendAction(target, 2, MAX_LAUNCH_QUEUE_SIZE + 1), sender);
  assert.equal(result.code, "queue_full");
  assert.equal(sender.attack.queue.length, MAX_LAUNCH_QUEUE_SIZE);
  assert.equal(sender.economy.coins, coinsBefore);
  assert.equal(sender.economy.income, incomeBefore);
});

test("launch queue emits at most one balloon per scheduler action even after a large time jump", () => {
  const sender = createBalloonRoom("catchup-sender");
  const target = createBalloonRoom("catchup-target");
  for (let sequence = 1; sequence <= 3; sequence += 1) applySend(target, sendAction(target, sequence, sequence), sender);
  assert.ok(applyLaunch(sender, target, 0).launchedBalloon);
  assert.ok(applyLaunch(sender, target, 5000).launchedBalloon);
  assert.equal(target.balloons.length, 2);
  assert.equal(sender.attack.queue.length, 1);
  assert.equal(sender.attack.nextLaunchAt, 5600);
});

test("a later burst still respects spacing from the previous launch", () => {
  const sender = createBalloonRoom("burst-sender");
  const target = createBalloonRoom("burst-target");
  applySend(target, sendAction(target, 2, 1), sender);
  applyLaunch(sender, target, 1000);
  applySend(target, sendAction(target, 4, 2), sender);
  assert.equal(applyLaunch(sender, target, 1200).launchedBalloon, undefined);
  assert.ok(applyLaunch(sender, target, 1600).launchedBalloon);
  assert.deepEqual(target.balloons.map((balloon) => balloon.spawnLane), [2, 4]);
});

test("valid wall and nail purchases charge canonical costs", () => {
  const room = createBalloonRoom("defense-purchases");
  const vertical = wall(room, "vertical", 3, 8);
  assert.equal(applyGameAction(room, { type: "PLACE_WALL", wall: vertical }).applied, true);
  assert.equal(room.economy.coins, STARTING_COINS - VERTICAL_WALL_COST);
  assert.equal(applyGameAction(room, { type: "PLACE_NAILS", wallSegmentId: vertical.id }).applied, true);
  assert.equal(room.economy.coins, STARTING_COINS - VERTICAL_WALL_COST - NAIL_STRIP_COST);
  assert.equal(room.economy.income, STARTING_INCOME);
  const horizontal = wall(room, "horizontal", 2, 8);
  assert.equal(applyGameAction(room, { type: "PLACE_WALL", wall: horizontal }).applied, true);
  assert.equal(room.economy.coins, STARTING_COINS - VERTICAL_WALL_COST - NAIL_STRIP_COST - HORIZONTAL_WALL_COST);
});

test("insufficient wall and nail purchases are atomic", () => {
  const wallRoom = createBalloonRoom("poor-wall");
  wallRoom.economy.coins = VERTICAL_WALL_COST - 25;
  assert.equal(applyGameAction(wallRoom, { type: "PLACE_WALL", wall: wall(wallRoom, "vertical", 3, 8) }).code, "insufficient_coins");
  assert.equal(wallRoom.economy.coins, 50);
  assert.equal(wallRoom.walls.length, 0);

  const nailRoom = createBalloonRoom("poor-nails");
  const nailWall = wall(nailRoom, "vertical", 3, 8);
  placeWall(nailRoom, nailWall);
  nailRoom.economy.coins = NAIL_STRIP_COST - 10;
  assert.equal(applyGameAction(nailRoom, { type: "PLACE_NAILS", wallSegmentId: nailWall.id }).code, "insufficient_coins");
  assert.equal(nailRoom.economy.coins, 20);
  assert.equal(nailRoom.nailStrips.length, 0);
});

test("wall and nail removal never refund coins and replacement nails cost again", () => {
  const room = createBalloonRoom("no-refunds");
  const segment = wall(room, "vertical", 3, 8);
  applyGameAction(room, { type: "PLACE_WALL", wall: segment });
  applyGameAction(room, { type: "PLACE_NAILS", wallSegmentId: segment.id });
  const afterPurchases = room.economy.coins;
  assert.equal(applyGameAction(room, { type: "REMOVE_NAILS", wallSegmentId: segment.id }).applied, true);
  assert.equal(room.economy.coins, afterPurchases);
  assert.equal(applyGameAction(room, { type: "PLACE_NAILS", wallSegmentId: segment.id }).applied, true);
  assert.equal(room.economy.coins, afterPurchases - NAIL_STRIP_COST);
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: segment.id }).message, "One Nail Strip removed; wall remains");
  const beforeWallRemoval = room.economy.coins;
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: segment.id }).applied, true);
  assert.equal(room.economy.coins, beforeWallRemoval);
});

test("nail breakage and manual popping never change coins", () => {
  const room = createBalloonRoom("free-pop-no-refund");
  const segment = wall(room, "vertical", 3, 8);
  applyGameAction(room, { type: "PLACE_WALL", wall: segment });
  applyGameAction(room, { type: "PLACE_NAILS", wallSegmentId: segment.id });
  room.nailStrips[0].durability = 1;
  room.balloons.push(createBasicBalloon(room.id, "breaker", 2));
  const coinsBeforeBreak = room.economy.coins;
  updateRoomSimulation(room, 1);
  assert.equal(room.nailStrips.length, 0);
  assert.equal(room.economy.coins, coinsBeforeBreak);
  const remaining = room.balloons[0];
  assert.ok(remaining);
  applyGameAction(room, { type: "POP_BALLOON", balloonId: remaining.id });
  assert.equal(room.economy.coins, coinsBeforeBreak);
});

test("Phase 6 balloon configs centralize distinct HP, speed, damage, cost, and income", () => {
  assert.equal(BALLOON_TYPES.speed.maxHealth, SPEED_BALLOON_HP);
  assert.equal(BALLOON_TYPES.speed.speedMultiplier, SPEED_BALLOON_SPEED_MULTIPLIER);
  assert.equal(BALLOON_TYPES.speed.roomDamage, SPEED_BALLOON_ROOM_DAMAGE);
  assert.equal(BALLOON_TYPES.speed.cost, SPEED_BALLOON_COST);
  assert.equal(BALLOON_TYPES.speed.incomeGain, SPEED_BALLOON_INCOME_GAIN);
  assert.equal(BALLOON_TYPES.heavy.maxHealth, HEAVY_BALLOON_HP);
  assert.equal(BALLOON_TYPES.heavy.speedMultiplier, HEAVY_BALLOON_SPEED_MULTIPLIER);
  assert.equal(BALLOON_TYPES.heavy.roomDamage, HEAVY_BALLOON_ROOM_DAMAGE);
  assert.equal(BALLOON_TYPES.heavy.cost, HEAVY_BALLOON_COST);
  assert.equal(BALLOON_TYPES.heavy.incomeGain, HEAVY_BALLOON_INCOME_GAIN);
});

test("all balloon types share movement, manual damage, nails, and ceiling lifecycle", () => {
  for (const [balloonType, hits, roomDamage] of [["speed", 2, 1], ["heavy", 10, 3]]) {
    const room = createBalloonRoom(`${balloonType}-manual`);
    const balloon = createBalloon(room.id, `${balloonType}-balloon`, balloonType, 1);
    room.balloons.push(balloon);
    for (let hit = 1; hit <= hits; hit += 1) damageBalloon(room, balloon.id);
    assert.equal(room.balloons.length, 0);

    const escapeRoom = createBalloonRoom(`${balloonType}-escape`);
    escapeRoom.balloons.push(createBalloon(escapeRoom.id, `${balloonType}-escape-balloon`, balloonType, 1));
    updateRoomSimulation(escapeRoom, 40);
    assert.equal(escapeRoom.health, ROOM_MAX_HEALTH - roomDamage);

    const nailRoom = armedContactRoom(`${balloonType}-nails`);
    const nailBalloon = createBalloon(nailRoom.id, `${balloonType}-nail-balloon`, balloonType, 2);
    nailRoom.balloons.push(nailBalloon);
    updateRoomSimulation(nailRoom, 2);
    assert.equal(nailBalloon.health, 0);
    assert.equal(nailRoom.nailStrips.length, hits === NAIL_MAX_DURABILITY ? 0 : 1);
  }
});

test("five canonical rounds have the requested prototype compositions", () => {
  assert.deepEqual(WAVE_ROUNDS.map((round) => round.composition), [
    [{ balloonType: "basic", count: 20 }],
    [{ balloonType: "basic", count: 30 }],
    [{ balloonType: "basic", count: 20 }, { balloonType: "speed", count: 5 }],
    [{ balloonType: "basic", count: 15 }, { balloonType: "heavy", count: 1 }],
    [{ balloonType: "basic", count: 20 }, { balloonType: "speed", count: 5 }, { balloonType: "heavy", count: 2 }],
  ]);
});

test("Round 6 onward is generated, mixed, deterministic, and progressively harder", () => {
  const rounds = Array.from({ length: 10 }, (_, index) => getWaveRound(index + 6));
  assert.ok(rounds.every(Boolean));
  assert.deepEqual(rounds[0].composition, [
    { balloonType: "basic", count: 25 },
    { balloonType: "speed", count: 5 },
    { balloonType: "heavy", count: 2 },
  ]);
  const totals = rounds.map((round) => round.composition.reduce((sum, entry) => sum + entry.count, 0));
  for (let index = 1; index < totals.length; index += 1) assert.ok(totals[index] > totals[index - 1]);
  assert.deepEqual(getWaveRound(12), getWaveRound(12));
});

test("the match and every later round have canonical ten-second build countdowns", () => {
  assert.equal(PRE_ROUND_COUNTDOWN_MS, 10000);
  assert.equal(ROUND_TRANSITION_MS, 10000);
  const rooms = [createBalloonRoom("countdown-a"), createBalloonRoom("countdown-b")];
  const state = createWaveState(9);
  assert.equal(state.status, "transition");
  assert.equal(state.transitionFromRoundId, null);
  assert.equal(updateWaveState(state, rooms, PRE_ROUND_COUNTDOWN_MS - 1).spawnedBalloons.length, 0);
  const start = updateWaveState(state, rooms, PRE_ROUND_COUNTDOWN_MS);
  assert.equal(start.startedRoundId, 1);
  assert.equal(start.spawnedBalloons.length, 2);
  assert.equal(state.status, "active");
  state.spawnedCount = WAVE_ROUNDS[0].composition[0].count;
  rooms.forEach((room) => { room.balloons = []; });
  const roundCompletedAt = PRE_ROUND_COUNTDOWN_MS + 1;
  assert.equal(updateWaveState(state, rooms, roundCompletedAt).completedRoundId, 1);
  assert.equal(state.transitionEndsAt, roundCompletedAt + ROUND_TRANSITION_MS);
  assert.equal(updateWaveState(state, rooms, state.transitionEndsAt - 1).startedRoundId, null);
  assert.equal(updateWaveState(state, rooms, state.transitionEndsAt).startedRoundId, 2);
});

test("wave scheduler gives both rooms equivalent deterministic pressure without economy changes", () => {
  const rooms = [createBalloonRoom("wave-a"), createBalloonRoom("wave-b")];
  const state = createWaveState(17);
  const economyBefore = rooms.map((room) => ({ ...room.economy }));
  for (let sequence = 0; sequence < 20; sequence += 1) {
    const result = updateWaveState(state, rooms, PRE_ROUND_COUNTDOWN_MS + sequence * WAVE_BALLOON_SPAWN_INTERVAL_MS);
    assert.equal(result.spawnedBalloons.length, 2);
    assert.equal(result.spawnedBalloons[0].balloonType, "basic");
    assert.equal(result.spawnedBalloons[0].spawnLane, result.spawnedBalloons[1].spawnLane);
    assert.equal(result.spawnedBalloons[0].source, "wave");
    assert.equal(result.spawnedBalloons[0].roundId, 1);
    assert.equal(result.spawnedBalloons[0].waveSequence, sequence);
  }
  assert.deepEqual(rooms.map((room) => room.economy), economyBefore);
  assert.equal(rooms[0].attack.queue.length, 0);
  assert.equal(rooms[1].attack.queue.length, 0);
});

test("round completion ignores player traffic and unlocks only after exposure", () => {
  const rooms = [createBalloonRoom("progress-a"), createBalloonRoom("progress-b")];
  const state = createWaveState(3);
  let time = PRE_ROUND_COUNTDOWN_MS;
  updateWaveState(state, rooms, time);
  const drainRound = (roundIndex) => {
    const total = WAVE_ROUNDS[roundIndex].composition.reduce((sum, entry) => sum + entry.count, 0);
    for (let sequence = 0; sequence < total; sequence += 1) {
      updateWaveState(state, rooms, time);
      for (const room of rooms) room.balloons = room.balloons.filter((balloon) => balloon.source !== "wave");
      time += WAVE_BALLOON_SPAWN_INTERVAL_MS;
    }
    return updateWaveState(state, rooms, time);
  };

  const playerBalloon = createBalloon(rooms[0].id, "unrelated-player", "basic", 1, "left", "player", { senderId: "player" });
  rooms[0].balloons.push(playerBalloon);
  assert.equal(drainRound(0).completedRoundId, 1);
  assert.equal(rooms[0].balloons.includes(playerBalloon), true);
  assert.equal(rooms[0].unlockedBalloonTypes.speed, false);
  time += ROUND_TRANSITION_MS;
  updateWaveState(state, rooms, time);
  assert.equal(drainRound(1).completedRoundId, 2);
  time += ROUND_TRANSITION_MS;
  updateWaveState(state, rooms, time);
  assert.equal(rooms[0].unlockedBalloonTypes.speed, false);
  const roundThree = drainRound(2);
  assert.equal(roundThree.completedRoundId, 3);
  assert.equal(roundThree.unlockedBalloonType, "speed");
  assert.equal(rooms.every((room) => room.unlockedBalloonTypes.speed), true);
  assert.equal(rooms.every((room) => !room.unlockedBalloonTypes.heavy), true);
  time += ROUND_TRANSITION_MS;
  updateWaveState(state, rooms, time);
  const roundFour = drainRound(3);
  assert.equal(roundFour.completedRoundId, 4);
  assert.equal(roundFour.unlockedBalloonType, "heavy");
  assert.equal(rooms.every((room) => room.unlockedBalloonTypes.heavy), true);
  time += ROUND_TRANSITION_MS;
  updateWaveState(state, rooms, time);
  const roundFive = drainRound(4);
  assert.equal(roundFive.completedRoundId, 5);
  assert.equal(roundFive.allWavesComplete, false);
  assert.equal(state.status, "transition");
  time += ROUND_TRANSITION_MS;
  assert.equal(updateWaveState(state, rooms, time).startedRoundId, 6);
  assert.equal(state.status, "active");
});

test("mixed unlocked purchases are atomic, economic, FIFO, and launch as selected types", () => {
  const sender = createBalloonRoom("mixed-sender");
  const target = createBalloonRoom("mixed-target");
  sender.unlockedBalloonTypes.speed = true;
  sender.unlockedBalloonTypes.heavy = true;
  sender.economy.coins = 500;
  const types = ["basic", "speed", "heavy"];
  const lanes = [1, 4, 2];
  types.forEach((balloonType, index) => {
    const action = createSendBalloonAction({ matchId: "mixed", senderId: "player", targetRoomId: target.id, lane: lanes[index], senderSequence: index + 1, sentAt: index * 100, balloonType });
    assert.equal(applyGameAction(sender, action, target).applied, true);
  });
  assert.deepEqual(sender.attack.queue.map((queued) => [queued.balloonType, queued.lane]), [["basic", 1], ["speed", 4], ["heavy", 2]]);
  assert.equal(sender.economy.coins, 500 - BASIC_BALLOON_COST - SPEED_BALLOON_COST - HEAVY_BALLOON_COST);
  assert.equal(sender.economy.income, STARTING_INCOME + BASIC_BALLOON_INCOME_GAIN + SPEED_BALLOON_INCOME_GAIN + HEAVY_BALLOON_INCOME_GAIN);
  [0, 600, 1200].forEach((simulationTimeMs) => applyLaunch(sender, target, simulationTimeMs));
  assert.deepEqual(target.balloons.map((balloon) => [balloon.balloonType, balloon.spawnLane, balloon.source]), [["basic", 1, "player"], ["speed", 4, "player"], ["heavy", 2, "player"]]);
});

test("Phase 7 walls start at canonical full integrity", () => {
  const room = createBalloonRoom("integrity-start");
  const segment = wall(room, "vertical", 3, 8);
  assert.equal(segment.integrity, WALL_MAX_INTEGRITY);
  assert.equal(segment.maxIntegrity, WALL_MAX_INTEGRITY);
  assert.equal(placeWall(room, segment).valid, true);
  assert.deepEqual([room.walls[0].integrity, room.walls[0].maxIntegrity], [10, 10]);
});

test("Basic and Speed contacts never damage wall structure", () => {
  for (const balloonType of ["basic", "speed"]) {
    const room = createBalloonRoom(`no-structure-${balloonType}`);
    const segment = wall(room, "horizontal", 2, 9);
    placeWall(room, wall(room, "vertical", 3, 8));
    placeWall(room, segment);
    resolveStartingContact(room, createBalloon(room.id, `${balloonType}-contact`, balloonType, 2));
    assert.equal(segment.integrity, WALL_MAX_INTEGRITY);
  }
});

test("Heavy direct and glancing contacts use generalized movement orientation", () => {
  const directRoom = createBalloonRoom("direct-impact");
  placeWall(directRoom, wall(directRoom, "vertical", 3, 8));
  const horizontal = wall(directRoom, "horizontal", 2, 9);
  placeWall(directRoom, horizontal);
  const directEvents = resolveStartingContact(directRoom, createBalloon(directRoom.id, "direct-heavy", "heavy", 2));
  const direct = directEvents.find((event) => event.type === "wall_damage" && event.wallSegmentId === horizontal.id);
  assert.equal(direct?.impact, "direct");
  assert.equal(direct?.damage, HEAVY_DIRECT_STRUCTURAL_DAMAGE);
  assert.equal(horizontal.integrity, 8);

  const glancingRoom = createBalloonRoom("glancing-impact");
  const vertical = wall(glancingRoom, "vertical", 3, 9);
  placeWall(glancingRoom, vertical);
  const glancingEvents = resolveStartingContact(glancingRoom, createBalloon(glancingRoom.id, "glancing-heavy", "heavy", 2));
  const glancing = glancingEvents.find((event) => event.type === "wall_damage" && event.wallSegmentId === vertical.id);
  assert.equal(glancing?.impact, "glancing");
  assert.equal(glancing?.damage, HEAVY_GLANCING_STRUCTURAL_DAMAGE);
  assert.equal(vertical.integrity, 9);

  assert.equal(
    classifyStructuralImpact(
      { column: 1, row: 5 },
      { column: 2, row: 5 },
      wall(glancingRoom, "vertical", 3, 5),
    ),
    "direct",
  );
});

test("a horizontal wall is destroyed after five direct Heavy encounters with no refund", () => {
  const room = createBalloonRoom("five-directs");
  placeWall(room, wall(room, "vertical", 3, 8));
  const horizontal = wall(room, "horizontal", 2, 9);
  placeWall(room, horizontal);
  const coinsBefore = room.economy.coins;
  for (let impact = 1; impact <= 5; impact += 1) {
    resolveStartingContact(room, createBalloon(room.id, `heavy-${impact}`, "heavy", 2));
    assert.equal(horizontal.integrity, Math.max(0, 10 - impact * 2));
  }
  assert.equal(room.walls.some((candidate) => candidate.id === horizontal.id), false);
  assert.equal(room.economy.coins, coinsBefore);
});

test("wall destruction removes attachments and deterministically collapses unsupported spans", () => {
  const room = createBalloonRoom("support-collapse");
  const support = wall(room, "vertical", 3, 8);
  const spans = [1, 2, 3, 4].map((gridX) => wall(room, "horizontal", gridX, 9));
  placeWall(room, support);
  for (const index of [1, 0, 2, 3]) assert.equal(placeWall(room, spans[index]).valid, true);
  placeNailStrip(room, support.id);
  placeGlueTrap(room, support.id);
  placeNailStrip(room, spans[1].id);
  placeGlueTrap(room, spans[1].id);
  const coinsBefore = room.economy.coins;
  const result = damageWallStructure(room, support.id, WALL_MAX_INTEGRITY);
  assert.ok(result?.destruction);
  assert.deepEqual(result.destruction.collapsedWalls.map((wall) => wall.id), spans.map((wall) => wall.id));
  assert.equal(room.walls.length, 0);
  assert.equal(room.nailStrips.length, 0);
  assert.equal(room.glueTraps.length, 0);
  assert.equal(room.economy.coins, coinsBefore);
  assert.equal(getUnsupportedHorizontalWalls(room.walls).length, 0);
});

test("Nails kill before Heavy structure damage, while a surviving Heavy still impacts", () => {
  const killedRoom = createBalloonRoom("dead-heavy-order");
  placeWall(killedRoom, wall(killedRoom, "vertical", 3, 8));
  const lethalWall = wall(killedRoom, "horizontal", 2, 9);
  placeWall(killedRoom, lethalWall);
  placeNailStrip(killedRoom, lethalWall.id);
  const killedEvents = resolveStartingContact(killedRoom, createBalloon(killedRoom.id, "dead-heavy", "heavy", 2));
  assert.equal(killedEvents.some((event) => event.type === "nail_contact" && event.popped), true);
  assert.equal(killedEvents.some((event) => event.type === "wall_damage"), false);
  assert.equal(lethalWall.integrity, WALL_MAX_INTEGRITY);

  const survivorRoom = createBalloonRoom("surviving-heavy-order");
  placeWall(survivorRoom, wall(survivorRoom, "vertical", 3, 8));
  const armedWall = wall(survivorRoom, "horizontal", 2, 9);
  placeWall(survivorRoom, armedWall);
  placeGlueTrap(survivorRoom, armedWall.id);
  placeNailStrip(survivorRoom, armedWall.id);
  survivorRoom.nailStrips[0].durability = 4;
  const survivor = createBalloon(survivorRoom.id, "surviving-heavy", "heavy", 2);
  const survivorEvents = resolveStartingContact(survivorRoom, survivor);
  assert.deepEqual(survivorEvents.map((event) => event.type).slice(0, 3), ["glue_contact", "nail_contact", "wall_damage"]);
  assert.equal(survivor.health, 6);
  assert.equal(armedWall.integrity, 8);
});

test("PvE and player Heavy balloons use identical structural rules and wall changes invalidate live paths", () => {
  for (const source of ["wave", "player"]) {
    const room = createBalloonRoom(`source-${source}`);
    placeWall(room, wall(room, "vertical", 3, 8));
    const segment = wall(room, "horizontal", 2, 9);
    placeWall(room, segment);
    const observer = createBasicBalloon(room.id, `${source}-observer`, 1);
    recalculateBalloonPath(room, observer);
    room.balloons.push(observer);
    const heavy = createBalloon(room.id, `${source}-heavy`, "heavy", 2, "left", source, source === "wave" ? { roundId: 4, waveSequence: 0 } : { senderId: "attacker" });
    resolveStartingContact(room, heavy);
    assert.equal(segment.integrity, 8);
    damageWallStructure(room, segment.id, 8);
    assert.equal(observer.pathRevision, -1);
    updateBalloonPosition(room, observer, 0.001);
    assert.equal(observer.pathRevision, room.wallRevision);
  }
});

test("destroyed walls free capacity and replacements start at full integrity", () => {
  const room = createBalloonRoom("rebuild");
  const segment = wall(room, "vertical", 3, 9);
  placeWall(room, segment);
  damageWallStructure(room, segment.id, WALL_MAX_INTEGRITY);
  assert.equal(room.walls.length, 0);
  const replacement = wall(room, "vertical", 3, 9);
  assert.equal(placeWall(room, replacement).valid, true);
  assert.equal(replacement.integrity, WALL_MAX_INTEGRITY);
  assert.equal(room.walls.length, 1);
});
