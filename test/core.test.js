import assert from "node:assert/strict";
import test from "node:test";
import {
  BASIC_BALLOON_HP,
  BASIC_BALLOON_ROOM_DAMAGE,
  ENTRY_LANES,
  MAX_NAIL_STRIPS,
  NAIL_MAX_DURABILITY,
  ROOM_MAX_HEALTH,
  applyGameAction,
  createBalloonRoom,
  createBasicBalloon,
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

test("nails break at zero and broken nails deal no damage", () => {
  const room = armedContactRoom("break", 1);
  const breaker = createBasicBalloon(room.id, "breaker", 2);
  room.balloons.push(breaker);
  updateRoomSimulation(room, 1);
  assert.equal(room.nailStrips[0].status, "broken");
  assert.equal(room.nailStrips[0].durability, 0);
  const next = createBasicBalloon(room.id, "next", 2);
  room.balloons.push(next);
  updateRoomSimulation(room, 1);
  assert.equal(next.health, BASIC_BALLOON_HP);
});

test("breaking nails leaves the wall intact", () => {
  const room = armedContactRoom("wall-after-break", 1);
  room.balloons.push(createBasicBalloon(room.id, "breaker", 2));
  updateRoomSimulation(room, 1);
  assert.equal(room.walls.length, 1);
  assert.equal(room.nailStrips[0].status, "broken");
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
