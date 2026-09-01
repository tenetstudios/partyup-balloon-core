import type { BalloonRoom, PlayerEconomy } from "./types.js";
export type IncomeTickResult = {
    valid: boolean;
    code: "valid" | "invalid_time";
    message: string;
    ticksApplied: number;
    coinsGranted: number;
};
export declare function createPlayerEconomy(): PlayerEconomy;
export declare function applyIncomeTicks(room: BalloonRoom, simulationTimeMs: number): IncomeTickResult;
//# sourceMappingURL=economy.d.ts.map