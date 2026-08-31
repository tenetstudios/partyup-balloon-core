import type { GridCell, GridEdge, SpawnLane, WallOrientation, WallSegment } from "./types.js";
export declare const SPAWN_LANES: SpawnLane[];
export declare function getLaneCell(lane: SpawnLane): GridCell;
export declare function getCellCenter(cell: GridCell): {
    x: number;
    y: number;
};
export declare function cellsEqual(first: GridCell, second: GridCell): boolean;
export declare function isCellInGrid(cell: GridCell): boolean;
export declare function getAdjacentCells(cell: GridCell, horizontalPreference: "left" | "right"): GridCell[];
export declare function getWallId(roomId: string, orientation: WallOrientation, gridX: number, gridY: number): string;
export declare function createWallSegment(roomId: string, orientation: WallOrientation, gridX: number, gridY: number): WallSegment;
export declare function isValidWallEdge(wall: WallSegment): boolean;
export declare function wallBlocksCells(wall: WallSegment, first: GridCell, second: GridCell): boolean;
export declare function isTraversalBlocked(first: GridCell, second: GridCell, walls: WallSegment[]): boolean;
export declare function findClosestGridEdge(x: number, y: number, renderedWidth: number, renderedHeight: number, maximumDistancePixels?: number): GridEdge | null;
//# sourceMappingURL=grid.d.ts.map