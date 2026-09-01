import type { Balloon, BalloonRoom, PlayerAttackState, QueuedBalloon, SendBalloonAction, SendBalloonValidationCode, SendBalloonResult } from "./types.js";
export type LaunchQueueResult = {
    valid: boolean;
    code: SendBalloonValidationCode;
    message: string;
    balloon?: Balloon;
};
export declare function createPlayerAttackState(): PlayerAttackState;
export declare function validateBalloonPurchase(senderRoom: BalloonRoom, targetRoom: BalloonRoom, action: SendBalloonAction): SendBalloonResult;
export declare function enqueueBalloon(senderRoom: BalloonRoom, action: SendBalloonAction): QueuedBalloon;
export declare function applyLaunchQueue(senderRoom: BalloonRoom, targetRoom: BalloonRoom, simulationTimeMs: number): LaunchQueueResult;
//# sourceMappingURL=attack.d.ts.map