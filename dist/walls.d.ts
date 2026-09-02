import type { BalloonRoom, BalloonType, GridCell, StructuralImpact, WallDestructionResult, WallSegment, WallValidationResult } from "./types.js";
export type StructuralDamageResult = {
    wallSegmentId: string;
    damage: number;
    integrityBefore: number;
    integrityAfter: number;
    destruction: WallDestructionResult | null;
};
export declare function getUnsupportedHorizontalWalls(walls: WallSegment[]): WallSegment[];
export declare function hasRequiredRoutes(room: BalloonRoom, walls: WallSegment[]): boolean;
export declare function validateWallPlacement(room: BalloonRoom, wall: WallSegment): WallValidationResult;
export declare function placeWall(room: BalloonRoom, wall: WallSegment): WallValidationResult;
export declare function classifyStructuralImpact(from: GridCell, to: GridCell, wall: WallSegment): StructuralImpact;
export declare function getStructuralDamage(balloonType: BalloonType, impact: StructuralImpact): number;
export declare function damageWallStructure(room: BalloonRoom, wallSegmentId: string, damage: number): StructuralDamageResult | null;
export declare function destroyWallAndCollapse(room: BalloonRoom, wallSegmentId: string): WallDestructionResult | null;
export declare function validateWallRemoval(room: BalloonRoom, wallId: string): WallValidationResult;
export declare function removeWall(room: BalloonRoom, wallId: string): WallValidationResult;
//# sourceMappingURL=walls.d.ts.map