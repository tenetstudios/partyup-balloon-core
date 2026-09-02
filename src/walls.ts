import {
  BASIC_STRUCTURAL_DAMAGE,
  HEAVY_DIRECT_STRUCTURAL_DAMAGE,
  HEAVY_GLANCING_STRUCTURAL_DAMAGE,
  MAX_HORIZONTAL_SUPPORT_DISTANCE,
  MAX_WALL_SEGMENTS,
  SPEED_STRUCTURAL_DAMAGE,
  WALL_MAX_INTEGRITY,
} from "./constants.js";
import { getLaneCell, isValidWallEdge, SPAWN_LANES } from "./grid.js";
import { findPathToCeiling } from "./pathfinding.js";
import type {
  BalloonRoom,
  BalloonType,
  GridCell,
  StructuralImpact,
  WallDestructionResult,
  WallSegment,
  WallValidationResult,
} from "./types.js";

export type StructuralDamageResult = {
  wallSegmentId: string;
  damage: number;
  integrityBefore: number;
  integrityAfter: number;
  destruction: WallDestructionResult | null;
};

export function getUnsupportedHorizontalWalls(walls: WallSegment[]): WallSegment[] {
  const horizontalWalls = walls.filter((wall) => wall.orientation === "horizontal");
  const supportVertices = new Set<string>();
  for (const wall of walls) {
    if (wall.orientation !== "vertical") continue;
    supportVertices.add(vertexKey(wall.gridX, wall.gridY));
    supportVertices.add(vertexKey(wall.gridX, wall.gridY + 1));
  }
  return horizontalWalls.filter((wall) => {
    const distances = new Map<string, number>();
    const queue: Array<{ x: number; distance: number }> = [];
    for (const vertex of supportVertices) {
      const [x, y] = vertex.split(":").map(Number);
      if (x === undefined || y !== wall.gridY) continue;
      distances.set(vertex, 0);
      queue.push({ x, distance: 0 });
    }
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current || current.distance >= MAX_HORIZONTAL_SUPPORT_DISTANCE) continue;
      for (const direction of [-1, 1]) {
        const segmentX = direction < 0 ? current.x - 1 : current.x;
        if (!horizontalWalls.some((candidate) => candidate.gridY === wall.gridY && candidate.gridX === segmentX)) continue;
        const nextX = current.x + direction;
        const key = vertexKey(nextX, wall.gridY);
        if (distances.has(key)) continue;
        distances.set(key, current.distance + 1);
        queue.push({ x: nextX, distance: current.distance + 1 });
      }
    }
    const leftDistance = distances.get(vertexKey(wall.gridX, wall.gridY));
    const rightDistance = distances.get(vertexKey(wall.gridX + 1, wall.gridY));
    return Math.min(leftDistance ?? Infinity, rightDistance ?? Infinity) >= MAX_HORIZONTAL_SUPPORT_DISTANCE;
  });
}

export function hasRequiredRoutes(room: BalloonRoom, walls: WallSegment[]): boolean {
  for (const lane of SPAWN_LANES) if (!findPathToCeiling(getLaneCell(lane), walls, "left")) return false;
  for (const balloon of room.balloons) if (balloon.status === "active" && !findPathToCeiling(balloon.currentCell, walls, balloon.pathBias)) return false;
  return true;
}

export function validateWallPlacement(room: BalloonRoom, wall: WallSegment): WallValidationResult {
  if (!isValidWallEdge(wall)) return { valid: false, code: "invalid_edge", message: "Choose an inside grid edge" };
  if (room.walls.some((candidate) => candidate.id === wall.id)) return { valid: false, code: "duplicate", message: "Wall already placed" };
  if (room.walls.length >= MAX_WALL_SEGMENTS) return { valid: false, code: "budget_reached", message: "Wall limit reached" };
  const proposedWalls = [...room.walls, wall];
  if (getUnsupportedHorizontalWalls(proposedWalls).length > 0) return { valid: false, code: "needs_support", message: "Needs support" };
  if (!hasRequiredRoutes(room, proposedWalls)) return { valid: false, code: "path_required", message: "Path required" };
  return { valid: true, code: "valid", message: "Wall placed" };
}

export function placeWall(room: BalloonRoom, wall: WallSegment): WallValidationResult {
  const validation = validateWallPlacement(room, wall);
  if (!validation.valid) return validation;
  wall.integrity = WALL_MAX_INTEGRITY;
  wall.maxIntegrity = WALL_MAX_INTEGRITY;
  room.walls.push(wall);
  room.wallRevision += 1;
  return validation;
}

export function classifyStructuralImpact(
  from: GridCell,
  to: GridCell,
  wall: WallSegment,
): StructuralImpact {
  const horizontalMovement = Math.abs(to.column - from.column) > Math.abs(to.row - from.row);
  const directlyOpposesMovement = horizontalMovement
    ? wall.orientation === "vertical"
    : wall.orientation === "horizontal";
  return directlyOpposesMovement ? "direct" : "glancing";
}

export function getStructuralDamage(balloonType: BalloonType, impact: StructuralImpact): number {
  if (balloonType === "basic") return BASIC_STRUCTURAL_DAMAGE;
  if (balloonType === "speed") return SPEED_STRUCTURAL_DAMAGE;
  return impact === "direct" ? HEAVY_DIRECT_STRUCTURAL_DAMAGE : HEAVY_GLANCING_STRUCTURAL_DAMAGE;
}

export function damageWallStructure(
  room: BalloonRoom,
  wallSegmentId: string,
  damage: number,
): StructuralDamageResult | null {
  const wall = room.walls.find((candidate) => candidate.id === wallSegmentId);
  if (!wall || damage <= 0) return null;
  const integrityBefore = wall.integrity;
  wall.integrity = Math.max(0, wall.integrity - damage);
  if (wall.integrity > 0) {
    return { wallSegmentId, damage, integrityBefore, integrityAfter: wall.integrity, destruction: null };
  }
  const destruction = destroyWallAndCollapse(room, wallSegmentId);
  return { wallSegmentId, damage, integrityBefore, integrityAfter: 0, destruction };
}

export function destroyWallAndCollapse(room: BalloonRoom, wallSegmentId: string): WallDestructionResult | null {
  const destroyedWall = room.walls.find((wall) => wall.id === wallSegmentId);
  if (!destroyedWall) return null;

  const removedWalls: WallSegment[] = [{ ...destroyedWall, integrity: 0 }];
  room.walls = room.walls.filter((wall) => wall.id !== wallSegmentId);

  while (true) {
    const unsupported = getUnsupportedHorizontalWalls(room.walls).sort(compareWalls);
    if (unsupported.length === 0) break;
    const unsupportedIds = new Set(unsupported.map((wall) => wall.id));
    removedWalls.push(...unsupported.map((wall) => ({ ...wall })));
    room.walls = room.walls.filter((wall) => !unsupportedIds.has(wall.id));
  }

  const removedWallIds = new Set(removedWalls.map((wall) => wall.id));
  const removedNailStripIds = room.nailStrips
    .filter((nail) => removedWallIds.has(nail.wallSegmentId))
    .map((nail) => nail.id)
    .sort();
  const removedGlueIds = room.glueTraps
    .filter((glue) => removedWallIds.has(glue.wallSegmentId))
    .map((glue) => glue.id)
    .sort();

  room.nailStrips = room.nailStrips.filter((nail) => !removedWallIds.has(nail.wallSegmentId));
  room.glueTraps = room.glueTraps.filter((glue) => !removedWallIds.has(glue.wallSegmentId));
  for (const balloon of room.balloons) {
    balloon.contactingNailIds = balloon.contactingNailIds.filter((id) => !removedNailStripIds.includes(id));
    balloon.contactingWallIds = balloon.contactingWallIds.filter((id) => !removedWallIds.has(id));
    balloon.pathRevision = -1;
  }
  room.wallRevision += 1;

  return {
    destroyedWall: removedWalls[0]!,
    collapsedWalls: removedWalls.slice(1),
    removedNailStripIds,
    removedGlueIds,
  };
}

export function validateWallRemoval(room: BalloonRoom, wallId: string): WallValidationResult {
  if (!room.walls.some((wall) => wall.id === wallId)) return { valid: false, code: "not_found", message: "Select an existing wall" };
  const proposedWalls = room.walls.filter((wall) => wall.id !== wallId);
  if (getUnsupportedHorizontalWalls(proposedWalls).length > 0) return { valid: false, code: "supporting_span", message: "Supporting active span" };
  return { valid: true, code: "valid", message: "Wall removed" };
}

export function removeWall(room: BalloonRoom, wallId: string): WallValidationResult {
  const validation = validateWallRemoval(room, wallId);
  if (!validation.valid) return validation;
  room.walls = room.walls.filter((wall) => wall.id !== wallId);
  room.nailStrips = room.nailStrips.filter((nail) => nail.wallSegmentId !== wallId);
  room.glueTraps = room.glueTraps.filter((glue) => glue.wallSegmentId !== wallId);
  room.wallRevision += 1;
  return validation;
}

function vertexKey(x: number, y: number): string { return `${x}:${y}`; }

function compareWalls(first: WallSegment, second: WallSegment): number {
  return first.gridY - second.gridY || first.gridX - second.gridX || first.orientation.localeCompare(second.orientation) || first.id.localeCompare(second.id);
}
