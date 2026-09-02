export type BalloonStatus = "active" | "popped" | "escaped";
export type SpawnLane = 1 | 2 | 3 | 4;
export type PathBias = "left" | "right";
export type WallOrientation = "vertical" | "horizontal";
export type StructuralImpact = "direct" | "glancing";
export type NailStatus = "active" | "broken";
export type NailStripStatus = NailStatus;
export type BalloonType = "basic" | "speed" | "heavy";
export type BalloonSource = "wave" | "player";
export type BalloonTypeConfig = {
    maxHealth: number;
    speed: number;
    speedMultiplier: number;
    radius: number;
    roomDamage: number;
    cost: number;
    incomeGain: number;
};
export type BalloonUnlockState = Record<BalloonType, boolean>;
export type PlayerEconomy = {
    coins: number;
    income: number;
    nextIncomeTickAt: number;
};
export type QueuedBalloon = {
    id: string;
    balloonType: BalloonType;
    lane: SpawnLane;
    targetRoomId: string;
    purchasedAt: number;
    matchId: string;
    senderId: string;
    senderSequence: number;
};
export type PlayerAttackState = {
    queue: QueuedBalloon[];
    lastLaunchAt: number | null;
    nextLaunchAt: number | null;
};
export type GridPosition = {
    column: number;
    row: number;
};
export type GridCell = GridPosition;
export type GridEdge = {
    orientation: WallOrientation;
    gridX: number;
    gridY: number;
};
export type WallSegment = GridEdge & {
    id: string;
    roomId: string;
    integrity: number;
    maxIntegrity: number;
};
export type NailStrip = {
    id: string;
    roomId: string;
    wallSegmentId: string;
    durability: number;
    maxDurability: number;
    status: NailStatus;
};
export type GlueTrap = {
    id: string;
    roomId: string;
    wallSegmentId: string;
};
export type Balloon = {
    id: string;
    roomId: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    speed: number;
    radius: number;
    roomDamage: number;
    balloonType: BalloonType;
    source: BalloonSource;
    roundId: number | null;
    waveSequence: number | null;
    senderId: string | null;
    status: BalloonStatus;
    spawnLane: SpawnLane;
    pathBias: PathBias;
    currentCell: GridCell;
    targetCell: GridCell | null;
    path: GridCell[];
    pathRevision: number;
    contactingNailIds: string[];
    contactingWallIds: string[];
    glued: boolean;
};
export type RoomState = {
    id: string;
    economy: PlayerEconomy;
    attack: PlayerAttackState;
    unlockedBalloonTypes: BalloonUnlockState;
    health: number;
    maxHealth: number;
    balloons: Balloon[];
    processedSendIds: string[];
    walls: WallSegment[];
    nailStrips: NailStrip[];
    glueTraps: GlueTrap[];
    wallRevision: number;
    width: number;
    height: number;
};
export type BalloonRoom = RoomState;
export type BalloonSimulationEvent = {
    type: "balloon_popped";
    balloon: Balloon;
} | {
    type: "balloon_escaped";
    balloon: Balloon;
    damage: number;
} | {
    type: "nail_contact";
    balloonId: string;
    nailStripId: string;
    wallSegmentId: string;
    balloonHealthBefore: number;
    balloonHealthAfter: number;
    durabilityBefore: number;
    durabilityAfter: number;
    popped: boolean;
} | {
    type: "glue_contact";
    balloonId: string;
    glueId: string;
    wallSegmentId: string;
    speedBefore: number;
    speedAfter: number;
} | {
    type: "wall_damage";
    balloonId: string;
    wallSegmentId: string;
    impact: StructuralImpact;
    damage: number;
    integrityBefore: number;
    integrityAfter: number;
    destroyed: boolean;
} | {
    type: "wall_destroyed";
    balloonId: string;
    wall: WallSegment;
    collapsedWalls: WallSegment[];
    removedNailStripIds: string[];
    removedGlueIds: string[];
};
export type WallDestructionResult = {
    destroyedWall: WallSegment;
    collapsedWalls: WallSegment[];
    removedNailStripIds: string[];
    removedGlueIds: string[];
};
export type BalloonDamageResult = {
    balloonId: string;
    remainingHealth: number;
    popped: boolean;
};
export type WallValidationCode = "valid" | "invalid_edge" | "duplicate" | "budget_reached" | "needs_support" | "path_required" | "supporting_span" | "not_found";
export type WallValidationResult = {
    valid: boolean;
    code: WallValidationCode;
    message: string;
};
export type NailValidationCode = "valid" | "wall_required" | "limit_reached" | "not_found";
export type NailValidationResult = {
    valid: boolean;
    code: NailValidationCode;
    message: string;
};
export type GlueValidationCode = "valid" | "wall_required" | "duplicate" | "not_found";
export type GlueValidationResult = {
    valid: boolean;
    code: GlueValidationCode;
    message: string;
};
export type SendBalloonAction = {
    type: "SEND_BALLOON";
    balloonType: BalloonType;
    lane: SpawnLane;
    targetRoomId: string;
    balloonId: string;
    matchId: string;
    senderId: string;
    senderSequence: number;
    sentAt: number;
};
export type WaveCompositionEntry = {
    balloonType: BalloonType;
    count: number;
};
export type WaveRoundDefinition = {
    id: number;
    composition: readonly WaveCompositionEntry[];
    unlockAfterCompletion: BalloonType | null;
};
export type WaveStatus = "active" | "transition" | "complete";
export type WaveState = {
    seed: number;
    status: WaveStatus;
    roundIndex: number;
    spawnedCount: number;
    nextSpawnAt: number;
    transitionEndsAt: number | null;
    transitionFromRoundId: number | null;
};
export type WaveUpdateResult = {
    spawnedBalloons: Balloon[];
    completedRoundId: number | null;
    startedRoundId: number | null;
    unlockedBalloonType: BalloonType | null;
    allWavesComplete: boolean;
};
export type GameAction = {
    type: "PLACE_WALL";
    wall: WallSegment;
} | {
    type: "REMOVE_WALL";
    wallSegmentId: string;
} | {
    type: "REPAIR_WALL";
    wallSegmentId: string;
} | {
    type: "PLACE_NAILS";
    wallSegmentId: string;
} | {
    type: "REMOVE_NAILS";
    wallSegmentId: string;
} | {
    type: "PLACE_GLUE";
    wallSegmentId: string;
} | {
    type: "REMOVE_GLUE";
    wallSegmentId: string;
} | {
    type: "POP_BALLOON";
    balloonId: string;
} | {
    type: "APPLY_INCOME_TICK";
    simulationTimeMs: number;
} | {
    type: "APPLY_LAUNCH_QUEUE";
    simulationTimeMs: number;
} | SendBalloonAction;
export type GameActionResult = {
    action: GameAction["type"];
    applied: true;
    code: "valid";
    message: string;
    damage?: BalloonDamageResult;
    spawnedBalloon?: Balloon;
    queuedBalloon?: QueuedBalloon;
    launchedBalloon?: Balloon;
    incomeTicksApplied?: number;
} | {
    action: GameAction["type"];
    applied: false;
    code: string;
    message: string;
};
export type SendBalloonValidationCode = "valid" | "invalid_lane" | "target_not_found" | "room_closed" | "sender_room_closed" | "invalid_balloon_type" | "balloon_locked" | "duplicate_balloon_id" | "invalid_identity" | "invalid_metadata" | "path_unavailable" | "insufficient_coins" | "queue_full" | "invalid_time";
export type SendBalloonResult = {
    valid: boolean;
    code: SendBalloonValidationCode;
    message: string;
    balloon?: Balloon;
};
//# sourceMappingURL=types.d.ts.map