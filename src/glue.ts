import type { BalloonRoom, GlueTrap, GlueValidationResult, GridCell, WallSegment } from "./types.js";
import { wallTouchesCell } from "./nails.js";

export function createGlueTrap(roomId: string, wallSegmentId: string): GlueTrap {
  return { id: `${roomId}:glue:${wallSegmentId}`, roomId, wallSegmentId };
}

export function validateGluePlacement(room: BalloonRoom, wallSegmentId: string): GlueValidationResult {
  if (!room.walls.some((wall) => wall.id === wallSegmentId)) return { valid: false, code: "wall_required", message: "Glue needs an existing wall" };
  if (room.glueTraps.some((glue) => glue.wallSegmentId === wallSegmentId)) return { valid: false, code: "duplicate", message: "Wall already has Glue" };
  return { valid: true, code: "valid", message: "Glue attached" };
}

export function placeGlueTrap(room: BalloonRoom, wallSegmentId: string): GlueValidationResult {
  const validation = validateGluePlacement(room, wallSegmentId);
  if (!validation.valid) return validation;
  room.glueTraps.push(createGlueTrap(room.id, wallSegmentId));
  return validation;
}

export function removeGlueTrap(room: BalloonRoom, wallSegmentId: string): GlueValidationResult {
  const index = room.glueTraps.findIndex((glue) => glue.wallSegmentId === wallSegmentId);
  if (index < 0) return { valid: false, code: "not_found", message: "Wall has no Glue" };
  room.glueTraps.splice(index, 1);
  return { valid: true, code: "valid", message: "Glue removed" };
}

export function getGlueTouchingCell(room: BalloonRoom, cell: GridCell): GlueTrap[] {
  const wallIds = new Set(room.walls.filter((wall: WallSegment) => wallTouchesCell(wall, cell)).map((wall) => wall.id));
  return room.glueTraps.filter((glue) => wallIds.has(glue.wallSegmentId)).sort((first, second) => first.id.localeCompare(second.id));
}
