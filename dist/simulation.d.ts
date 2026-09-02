import type { Balloon, BalloonDamageResult, BalloonRoom, BalloonSimulationEvent, BalloonSource, BalloonType, PathBias, SpawnLane } from "./types.js";
export type DevBalloonSpawner = {
    secondsUntilSpawn: number;
    sequence: number;
    random: () => number;
};
export declare function createBalloonRoom(id: string): BalloonRoom;
export declare function createBasicBalloon(roomId: string, id: string, spawnLane: SpawnLane, pathBias?: PathBias): Balloon;
export declare function createBalloon(roomId: string, id: string, balloonType: BalloonType, spawnLane: SpawnLane, pathBias?: PathBias, source?: BalloonSource, metadata?: {
    roundId?: number;
    waveSequence?: number;
    senderId?: string;
}): Balloon;
export declare function recalculateBalloonPath(room: BalloonRoom, balloon: Balloon): boolean;
export declare function updateBalloonPosition(room: BalloonRoom, balloon: Balloon, deltaSeconds: number): BalloonSimulationEvent[];
export declare function updateRoomSimulation(room: BalloonRoom, deltaSeconds: number): BalloonSimulationEvent[];
export declare function damageBalloon(room: BalloonRoom, balloonId: string, damage?: number): BalloonDamageResult | null;
export declare function findBalloonAtPoint(room: BalloonRoom, x: number, y: number, minimumHitRadius?: number): Balloon | null;
export declare function createSeededRandom(seed: number): () => number;
export declare function createDevBalloonSpawner(seed: number): DevBalloonSpawner;
export declare function updateDevBalloonSpawner(room: BalloonRoom, spawner: DevBalloonSpawner, deltaSeconds: number): Balloon[];
//# sourceMappingURL=simulation.d.ts.map