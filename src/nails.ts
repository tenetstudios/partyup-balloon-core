import { MAX_NAIL_STRIPS, NAIL_MAX_DURABILITY } from "./constants.js";
import type { BalloonRoom, GridCell, NailStrip, NailValidationResult, WallSegment } from "./types.js";

export function createNailStrip(roomId: string, wallSegmentId: string): NailStrip {
  return { id: `${roomId}:nails:${wallSegmentId}`, roomId, wallSegmentId, durability: NAIL_MAX_DURABILITY, maxDurability: NAIL_MAX_DURABILITY, status: "active" };
}

export function validateNailPlacement(room: BalloonRoom, wallSegmentId: string): NailValidationResult {
  if (!room.walls.some((wall) => wall.id === wallSegmentId)) return { valid: false, code: "wall_required", message: "Nails need an existing wall" };
  if (room.nailStrips.length >= MAX_NAIL_STRIPS) return { valid: false, code: "limit_reached", message: "Nail limit reached" };
  return { valid: true, code: "valid", message: "Nail strip stacked" };
}

export function placeNailStrip(room: BalloonRoom, wallSegmentId: string): NailValidationResult {
  const validation = validateNailPlacement(room, wallSegmentId);
  if (!validation.valid) return validation;
  const strip = createNailStrip(room.id, wallSegmentId);
  const nextSequence = room.nailStrips.reduce((highest, nail) => {
    if (!nail.id.startsWith(`${strip.id}:`)) return highest;
    const sequence = Number(nail.id.slice(strip.id.length + 1));
    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0) + 1;
  strip.id = `${strip.id}:${nextSequence}`;
  room.nailStrips.push(strip);
  return validation;
}

export function removeNailStrip(room: BalloonRoom, wallSegmentId: string): NailValidationResult {
  const index = room.nailStrips.findIndex((nail) => nail.wallSegmentId === wallSegmentId);
  if (index < 0) return { valid: false, code: "not_found", message: "Wall has no nails" };
  const removed = room.nailStrips[index];
  if (!removed) return { valid: false, code: "not_found", message: "Wall has no nails" };
  room.nailStrips.splice(index, 1);
  for (const balloon of room.balloons) balloon.contactingNailIds = balloon.contactingNailIds.filter((id) => id !== removed.id);
  return { valid: true, code: "valid", message: "Nails removed" };
}

export function removeNailStripById(room: BalloonRoom, nailStripId: string): NailValidationResult {
  const nail = room.nailStrips.find((candidate) => candidate.id === nailStripId);
  if (!nail) return { valid: false, code: "not_found", message: "Nail strip not found" };
  const index = room.nailStrips.indexOf(nail);
  room.nailStrips.splice(index, 1);
  for (const balloon of room.balloons) balloon.contactingNailIds = balloon.contactingNailIds.filter((id) => id !== nail.id);
  return { valid: true, code: "valid", message: "Nail strip removed" };
}

export function wallTouchesCell(wall: WallSegment, cell: GridCell): boolean {
  if (wall.orientation === "vertical") return wall.gridY === cell.row && (cell.column === wall.gridX - 1 || cell.column === wall.gridX);
  return wall.gridX === cell.column && (cell.row === wall.gridY - 1 || cell.row === wall.gridY);
}

export function getNailsTouchingCell(room: BalloonRoom, cell: GridCell): NailStrip[] {
  const wallIds = new Set(getWallsTouchingCell(room, cell).map((wall) => wall.id));
  return room.nailStrips.filter((nail) => wallIds.has(nail.wallSegmentId)).sort((first, second) => first.id.localeCompare(second.id));
}

export function getWallsTouchingCell(room: BalloonRoom, cell: GridCell): WallSegment[] {
  return room.walls.filter((wall) => wallTouchesCell(wall, cell)).sort(compareWalls);
}

function compareWalls(first: WallSegment, second: WallSegment): number {
  return first.gridY - second.gridY || first.gridX - second.gridX || first.orientation.localeCompare(second.orientation) || first.id.localeCompare(second.id);
}
