import type { BalloonRoom, SendBalloonAction, SendBalloonResult, SpawnLane } from "./types.js";
export type CreateSendBalloonActionInput = {
    matchId: string;
    senderId: string;
    targetRoomId: string;
    lane: SpawnLane;
    senderSequence: number;
    sentAt: number;
};
export declare function createSendBalloonAction(input: CreateSendBalloonActionInput): SendBalloonAction;
export declare function createSentBalloonId(input: CreateSendBalloonActionInput): string;
export declare function validateSendBalloon(room: BalloonRoom, action: SendBalloonAction): SendBalloonResult;
export declare function sendBalloon(room: BalloonRoom, action: SendBalloonAction): SendBalloonResult;
//# sourceMappingURL=offense.d.ts.map