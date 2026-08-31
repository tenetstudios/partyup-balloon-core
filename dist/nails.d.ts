import type { BalloonRoom, GridCell, NailStrip, NailValidationResult, WallSegment } from "./types.js";
export declare function createNailStrip(roomId: string, wallSegmentId: string): NailStrip;
export declare function validateNailPlacement(room: BalloonRoom, wallSegmentId: string): NailValidationResult;
export declare function placeNailStrip(room: BalloonRoom, wallSegmentId: string): NailValidationResult;
export declare function removeNailStrip(room: BalloonRoom, wallSegmentId: string): NailValidationResult;
export declare function wallTouchesCell(wall: WallSegment, cell: GridCell): boolean;
export declare function getNailsTouchingCell(room: BalloonRoom, cell: GridCell): NailStrip[];
//# sourceMappingURL=nails.d.ts.map