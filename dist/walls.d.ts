import type { BalloonRoom, WallSegment, WallValidationResult } from "./types.js";
export declare function getUnsupportedHorizontalWalls(walls: WallSegment[]): WallSegment[];
export declare function hasRequiredRoutes(room: BalloonRoom, walls: WallSegment[]): boolean;
export declare function validateWallPlacement(room: BalloonRoom, wall: WallSegment): WallValidationResult;
export declare function placeWall(room: BalloonRoom, wall: WallSegment): WallValidationResult;
export declare function validateWallRemoval(room: BalloonRoom, wallId: string): WallValidationResult;
export declare function removeWall(room: BalloonRoom, wallId: string): WallValidationResult;
//# sourceMappingURL=walls.d.ts.map