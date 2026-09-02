import type { BalloonRoom, GlueTrap, GlueValidationResult, GridCell } from "./types.js";
export declare function createGlueTrap(roomId: string, wallSegmentId: string): GlueTrap;
export declare function validateGluePlacement(room: BalloonRoom, wallSegmentId: string): GlueValidationResult;
export declare function placeGlueTrap(room: BalloonRoom, wallSegmentId: string): GlueValidationResult;
export declare function removeGlueTrap(room: BalloonRoom, wallSegmentId: string): GlueValidationResult;
export declare function getGlueTouchingCell(room: BalloonRoom, cell: GridCell): GlueTrap[];
//# sourceMappingURL=glue.d.ts.map