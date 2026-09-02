import { BALLOON_TYPES, ENTRY_LANES, PRE_ROUND_COUNTDOWN_MS, ROUND_TRANSITION_MS, WAVE_BALLOON_SPAWN_INTERVAL_MS } from "./constants.js";
import { createBalloon, recalculateBalloonPath } from "./simulation.js";
import type { Balloon, BalloonRoom, BalloonType, SpawnLane, WaveRoundDefinition, WaveState, WaveUpdateResult } from "./types.js";

export const WAVE_ROUNDS: readonly WaveRoundDefinition[] = [
  { id: 1, composition: [{ balloonType: "basic", count: 20 }], unlockAfterCompletion: null },
  { id: 2, composition: [{ balloonType: "basic", count: 30 }], unlockAfterCompletion: null },
  { id: 3, composition: [{ balloonType: "basic", count: 20 }, { balloonType: "speed", count: 5 }], unlockAfterCompletion: "speed" },
  { id: 4, composition: [{ balloonType: "basic", count: 15 }, { balloonType: "heavy", count: 1 }], unlockAfterCompletion: "heavy" },
  { id: 5, composition: [{ balloonType: "basic", count: 20 }, { balloonType: "speed", count: 5 }, { balloonType: "heavy", count: 2 }], unlockAfterCompletion: null },
] as const;

export function createWaveState(seed: number, simulationTimeMs = 0): WaveState {
  if (!Number.isSafeInteger(seed)) throw new Error("Wave seed must be a safe integer");
  if (!Number.isFinite(simulationTimeMs) || simulationTimeMs < 0) throw new Error("Wave start time must be valid");
  return { seed, status: "transition", roundIndex: 0, spawnedCount: 0, nextSpawnAt: simulationTimeMs + PRE_ROUND_COUNTDOWN_MS, transitionEndsAt: simulationTimeMs + PRE_ROUND_COUNTDOWN_MS, transitionFromRoundId: null };
}

export function getCurrentWaveRound(state: WaveState): WaveRoundDefinition | null {
  return getWaveRound(state.roundIndex + 1);
}

export function getWaveRound(roundId: number): WaveRoundDefinition | null {
  if (!Number.isSafeInteger(roundId) || roundId < 1) return null;
  const explicit = WAVE_ROUNDS[roundId - 1];
  if (explicit) return explicit;
  const escalation = roundId - 6;
  return {
    id: roundId,
    composition: [
      { balloonType: "basic", count: 25 + Math.floor((escalation + 1) / 2) * 5 },
      { balloonType: "speed", count: 5 + Math.floor(escalation * 1.25) },
      { balloonType: "heavy", count: 2 + Math.floor(escalation / 2) },
    ],
    unlockAfterCompletion: null,
  };
}

export function getRoundBalloonTypes(round: WaveRoundDefinition): BalloonType[] {
  return round.composition.flatMap((entry) => Array.from({ length: entry.count }, () => entry.balloonType));
}

export function getWaveLane(seed: number, roundId: number, waveSequence: number): SpawnLane {
  const offset = positiveModulo(seed + roundId - 1, ENTRY_LANES.length);
  return ENTRY_LANES[(offset + waveSequence) % ENTRY_LANES.length]!;
}

export function getWaveBalloonId(seed: number, roundId: number, roomId: string, waveSequence: number): string {
  return ["wave", seed, `round-${roundId}`, encodeURIComponent(roomId), `spawn-${waveSequence}`].join(":");
}

export function updateWaveState(
  state: WaveState,
  rooms: readonly BalloonRoom[],
  simulationTimeMs: number,
): WaveUpdateResult {
  const result: WaveUpdateResult = { spawnedBalloons: [], completedRoundId: null, startedRoundId: null, unlockedBalloonType: null, allWavesComplete: state.status === "complete" };
  if (state.status === "complete" || rooms.length === 0 || !Number.isFinite(simulationTimeMs) || simulationTimeMs < 0) return result;

  if (state.status === "transition") {
    if (state.transitionEndsAt === null || simulationTimeMs < state.transitionEndsAt) return result;
    if (state.transitionFromRoundId !== null) state.roundIndex += 1;
    state.status = "active";
    state.spawnedCount = 0;
    state.nextSpawnAt = simulationTimeMs;
    state.transitionEndsAt = null;
    state.transitionFromRoundId = null;
    result.startedRoundId = getCurrentWaveRound(state)!.id;
  }

  const round = getCurrentWaveRound(state);
  if (!round) return result;
  const schedule = getRoundBalloonTypes(round);
  if (state.spawnedCount < schedule.length && simulationTimeMs >= state.nextSpawnAt) {
    const waveSequence = state.spawnedCount;
    const balloonType = schedule[waveSequence]!;
    const lane = getWaveLane(state.seed, round.id, waveSequence);
    const pathBias = (state.seed + round.id + waveSequence) % 2 === 0 ? "left" : "right";
    for (const room of rooms) {
      if (room.health <= 0) continue;
      const balloon = createBalloon(room.id, getWaveBalloonId(state.seed, round.id, room.id, waveSequence), balloonType, lane, pathBias, "wave", { roundId: round.id, waveSequence });
      if (!recalculateBalloonPath(room, balloon)) continue;
      room.balloons.push(balloon);
      result.spawnedBalloons.push(balloon);
    }
    state.spawnedCount += 1;
    state.nextSpawnAt = simulationTimeMs + WAVE_BALLOON_SPAWN_INTERVAL_MS;
  }

  const allScheduled = state.spawnedCount >= schedule.length;
  const activeRoundBalloons = rooms.some((room) => room.balloons.some((balloon) => balloon.source === "wave" && balloon.roundId === round.id && balloon.status === "active"));
  if (!allScheduled || activeRoundBalloons) return result;

  result.completedRoundId = round.id;
  if (round.unlockAfterCompletion) {
    for (const room of rooms) room.unlockedBalloonTypes[round.unlockAfterCompletion] = true;
    result.unlockedBalloonType = round.unlockAfterCompletion;
  }
  state.status = "transition";
  state.transitionEndsAt = simulationTimeMs + ROUND_TRANSITION_MS;
  state.transitionFromRoundId = round.id;
  return result;
}

export function getBalloonTypeConfig(balloonType: BalloonType) {
  return BALLOON_TYPES[balloonType];
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
