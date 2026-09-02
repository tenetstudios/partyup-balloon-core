import type { BalloonRoom, BalloonType, SpawnLane, WaveRoundDefinition, WaveState, WaveUpdateResult } from "./types.js";
export declare const WAVE_ROUNDS: readonly WaveRoundDefinition[];
export declare function createWaveState(seed: number, simulationTimeMs?: number): WaveState;
export declare function getCurrentWaveRound(state: WaveState): WaveRoundDefinition | null;
export declare function getWaveRound(roundId: number): WaveRoundDefinition | null;
export declare function getRoundBalloonTypes(round: WaveRoundDefinition): BalloonType[];
export declare function getWaveLane(seed: number, roundId: number, waveSequence: number): SpawnLane;
export declare function getWaveBalloonId(seed: number, roundId: number, roomId: string, waveSequence: number): string;
export declare function updateWaveState(state: WaveState, rooms: readonly BalloonRoom[], simulationTimeMs: number): WaveUpdateResult;
export declare function getBalloonTypeConfig(balloonType: BalloonType): {
    readonly maxHealth: 3;
    readonly speed: 0.105;
    readonly speedMultiplier: 1;
    readonly radius: 0.06;
    readonly roomDamage: 1;
    readonly cost: 25;
    readonly incomeGain: 3;
} | {
    readonly maxHealth: 2;
    readonly speed: number;
    readonly speedMultiplier: 1.6;
    readonly radius: number;
    readonly roomDamage: 1;
    readonly cost: 40;
    readonly incomeGain: 3;
} | {
    readonly maxHealth: 10;
    readonly speed: number;
    readonly speedMultiplier: 0.55;
    readonly radius: number;
    readonly roomDamage: 3;
    readonly cost: 100;
    readonly incomeGain: 5;
};
//# sourceMappingURL=waves.d.ts.map