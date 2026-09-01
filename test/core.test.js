import assert from "node:assert/strict";
import test from "node:test";
import {
  BASIC_BALLOON_COST,
  BASIC_BALLOON_HP,
  BASIC_BALLOON_INCOME_GAIN,
  BASIC_BALLOON_ROOM_DAMAGE,
  ENTRY_LANES,
  HORIZONTAL_WALL_COST,
  INCOME_TICK_INTERVAL_MS,
  MAX_NAIL_STRIPS,
  NAIL_STRIP_COST,
  NAIL_MAX_DURABILITY,
  ROOM_MAX_HEALTH,
  STARTING_COINS,
  STARTING_INCOME,
  VERTICAL_WALL_COST,
  applyGameAction,
  createBalloonRoom,
  createBasicBalloon,
  createSendBalloonAction,
  createWallSegment,
  damageBalloon,
  findPathToCeiling,
  getCellCenter,
  getLaneCell,
  getUnsupportedHorizontalWalls,
  hasRequiredRoutes,
  isTraversalBlocked,
  placeNailStrip,
  placeWall,
  recalculateBalloonPath,
  removeNailStrip,
  updateBalloonPosition,
  updateRoomSimulation,
  validateWallPlacement,
} from "../dist/index.js";

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

test("one SEND_BALLOON action creates exactly one basic balloon in the selected lane", () => {
  const room = createBalloonRoom("single-send");
  const result = applySend(room, sendAction(room, 3, 1));
  assert.equal(result.applied, true);
  assert.equal(room.balloons.length, 1);
  assert.equal(result.spawnedBalloon, room.balloons[0]);
  assert.equal(room.balloons[0].spawnLane, 3);
  assert.equal(room.balloons[0].health, BASIC_BALLOON_HP);
  assert.deepEqual(room.balloons[0].currentCell, getLaneCell(3));
});

test("repeated sends remain in the selected lane and create unique balloons", () => {
  const room = createBalloonRoom("repeat-send");
  const sender = createBalloonRoom("repeat-sender");
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    assert.equal(applySend(room, sendAction(room, 4, sequence), sender).applied, true);
  }
  assert.equal(room.balloons.length, 4);
  assert.deepEqual(room.balloons.map((balloon) => balloon.spawnLane), [4, 4, 4, 4]);
  assert.equal(new Set(room.balloons.map((balloon) => balloon.id)).size, 4);
});

test("changing the chosen lane changes the next balloon spawn lane", () => {
  const room = createBalloonRoom("change-lane");
  const sender = createBalloonRoom("change-sender");
  applySend(room, sendAction(room, 1, 1), sender);
  applySend(room, sendAction(room, 2, 2), sender);
  applySend(room, sendAction(room, 4, 3), sender);
  assert.deepEqual(room.balloons.map((balloon) => balloon.spawnLane), [1, 2, 4]);
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
  assert.equal(room.balloons.length, 1);
});

test("duplicate delivery remains rejected after the original balloon leaves active state", () => {
  const room = createBalloonRoom("identity-after-pop");
  const action = sendAction(room, 2, 9);
  const sender = createBalloonRoom("identity-after-pop-sender");
  assert.equal(applySend(room, action, sender).applied, true);
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
  assert.equal(applySend(room, sendAction(room, 1, 3, { balloonType: "heavy" }), sender).code, "invalid_balloon_type");
  assert.equal(applySend(room, sendAction(room, 1, 4, { balloonId: "forged" }), sender).code, "invalid_identity");
  assert.equal(applySend(room, sendAction(room, 1, 0), sender).code, "invalid_metadata");
  room.health = 0;
  assert.equal(applySend(room, sendAction(room, 1, 5), sender).code, "room_closed");
  assert.equal(room.balloons.length, 0);
});

test("a sent balloon immediately uses the target room pathfinding", () => {
  const room = createBalloonRoom("send-route");
  placeWall(room, wall(room, "vertical", 3, 5));
  placeWall(room, wall(room, "horizontal", 2, 5));
  const result = applySend(room, sendAction(room, 2, 1));
  assert.equal(result.applied, true);
  assert.ok(result.spawnedBalloon.path.some((cell) => cell.column === 1));
});

test("a sent balloon interacts with existing nails through normal simulation", () => {
  const room = armedContactRoom("sent-nails");
  const result = applySend(room, sendAction(room, 2, 1));
  assert.equal(result.applied, true);
  const events = updateRoomSimulation(room, 1).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 1);
  assert.equal(result.spawnedBalloon.health, BASIC_BALLOON_HP - 1);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - 1);
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

test("one valid nail contact deals one damage and consumes one durability", () => {
  const room = armedContactRoom("contact");
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  room.balloons.push(balloon);
  const events = updateRoomSimulation(room, 1).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 1);
  assert.equal(balloon.health, BASIC_BALLOON_HP - 1);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - 1);
});

test("continuous contact does not repeatedly damage", () => {
  const room = armedContactRoom("continuous");
  const balloon = createBasicBalloon(room.id, "balloon", 2);
  room.balloons.push(balloon);
  updateRoomSimulation(room, 1);
  updateRoomSimulation(room, 0.25);
  assert.equal(balloon.health, BASIC_BALLOON_HP - 1);
  assert.equal(room.nailStrips[0].durability, NAIL_MAX_DURABILITY - 1);
});

test("a genuine later encounter can damage again", () => {
  const room = createBalloonRoom("repeat");
  const structure = [
    wall(room, "vertical", 3, 4), wall(room, "horizontal", 2, 5),
    wall(room, "vertical", 1, 3), wall(room, "horizontal", 1, 4),
    wall(room, "horizontal", 0, 4), wall(room, "horizontal", 3, 4),
  ];
  for (const segment of structure) assert.equal(placeWall(room, segment).valid, true);
  placeNailStrip(room, structure[1].id);
  const balloon = createBasicBalloon(room.id, "balloon", 2, "left");
  room.balloons.push(balloon);
  recalculateBalloonPath(room, balloon);
  const events = updateBalloonPosition(room, balloon, 8).filter((event) => event.type === "nail_contact");
  assert.equal(events.length, 2);
  assert.equal(balloon.health, 1);
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

test("REMOVE_WALL removes nails first and the wall second", () => {
  const room = armedContactRoom("remove-action");
  const wallId = room.walls[0].id;
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: wallId }).message, "Nails removed; wall remains");
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
  assert.equal(balloon.health, 2);
});

test("direct damage API still deals exactly one by default", () => {
  const room = createBalloonRoom("damage");
  const balloon = createBasicBalloon(room.id, "balloon", 4);
  room.balloons.push(balloon);
  assert.deepEqual(damageBalloon(room, balloon.id), { balloonId: balloon.id, remainingHealth: 2, popped: false });
});

test("Phase 5 economy starts with canonical coins, income, and next tick", () => {
  const room = createBalloonRoom("economy-start");
  assert.deepEqual(room.economy, {
    coins: STARTING_COINS,
    income: STARTING_INCOME,
    nextIncomeTickAt: INCOME_TICK_INTERVAL_MS,
  });
});

test("income ticks use deterministic simulation time and catch up exactly", () => {
  const room = createBalloonRoom("income-ticks");
  room.economy.coins = 200;
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 4999 }).incomeTicksApplied, 0);
  assert.equal(room.economy.coins, 200);
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 5000 }).incomeTicksApplied, 1);
  assert.equal(room.economy.coins, 300);
  assert.equal(room.economy.nextIncomeTickAt, 10000);
  assert.equal(applyGameAction(room, { type: "APPLY_INCOME_TICK", simulationTimeMs: 15000 }).incomeTicksApplied, 2);
  assert.equal(room.economy.coins, 500);
  assert.equal(room.economy.nextIncomeTickAt, 20000);
});

test("successful sends cost coins, grow income, and create exactly one balloon each", () => {
  const sender = createBalloonRoom("economy-sender");
  const target = createBalloonRoom("economy-target");
  sender.economy.coins = 200;
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    assert.equal(applyGameAction(sender, sendAction(target, 3, sequence), target).applied, true);
  }
  assert.equal(sender.economy.coins, 200 - 4 * BASIC_BALLOON_COST);
  assert.equal(sender.economy.income, STARTING_INCOME + 4 * BASIC_BALLOON_INCOME_GAIN);
  assert.equal(target.balloons.length, 4);
});

test("five balloon investments compound into the next income tick", () => {
  const sender = createBalloonRoom("compound-sender");
  const target = createBalloonRoom("compound-target");
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    assert.equal(applyGameAction(sender, sendAction(target, 1, sequence), target).applied, true);
  }
  assert.equal(sender.economy.coins, 375);
  assert.equal(sender.economy.income, 125);
  applyGameAction(sender, { type: "APPLY_INCOME_TICK", simulationTimeMs: INCOME_TICK_INTERVAL_MS });
  assert.equal(sender.economy.coins, 500);
});

test("insufficient send is atomic and never creates a balloon", () => {
  const sender = createBalloonRoom("poor-sender");
  const target = createBalloonRoom("poor-target");
  sender.economy.coins = BASIC_BALLOON_COST - 5;
  const result = applyGameAction(sender, sendAction(target, 2, 1), target);
  assert.equal(result.code, "insufficient_coins");
  assert.equal(sender.economy.coins, 20);
  assert.equal(sender.economy.income, STARTING_INCOME);
  assert.equal(target.balloons.length, 0);
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
  assert.equal(applyGameAction(room, { type: "REMOVE_WALL", wallSegmentId: segment.id }).message, "Nails removed; wall remains");
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
