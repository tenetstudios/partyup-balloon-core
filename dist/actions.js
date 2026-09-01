import { placeNailStrip, removeNailStrip } from "./nails.js";
import { sendBalloon, validateSendBalloon } from "./offense.js";
import { damageBalloon } from "./simulation.js";
import { placeWall, removeWall, validateWallPlacement } from "./walls.js";
import { validateNailPlacement } from "./nails.js";
import { applyIncomeTicks } from "./economy.js";
import { BASIC_BALLOON_COST, BASIC_BALLOON_INCOME_GAIN, HORIZONTAL_WALL_COST, NAIL_STRIP_COST, VERTICAL_WALL_COST } from "./constants.js";
import { findPathToCeiling } from "./pathfinding.js";
import { getLaneCell } from "./grid.js";
export function applyGameAction(room, action, targetRoom) {
    if (action.type === "SEND_BALLOON") {
        if (room.health <= 0)
            return { action: action.type, applied: false, code: "sender_room_closed", message: "Your room is broken" };
        if (!targetRoom)
            return { action: action.type, applied: false, code: "target_not_found", message: "Target room not found" };
        const validation = validateSendBalloon(targetRoom, action);
        if (!validation.valid)
            return { action: action.type, applied: false, code: validation.code, message: validation.message };
        const pathBias = action.senderSequence % 2 === 0 ? "right" : "left";
        if (!findPathToCeiling(getLaneCell(action.lane), targetRoom.walls, pathBias)) {
            return { action: action.type, applied: false, code: "path_unavailable", message: "No route to the ceiling" };
        }
        if (room.economy.coins < BASIC_BALLOON_COST)
            return insufficientCoins(action.type, BASIC_BALLOON_COST);
        room.economy.coins -= BASIC_BALLOON_COST;
        room.economy.income += BASIC_BALLOON_INCOME_GAIN;
        const result = sendBalloon(targetRoom, action);
        return result.valid && result.balloon
            ? { action: action.type, applied: true, code: "valid", message: result.message, spawnedBalloon: result.balloon }
            : { action: action.type, applied: false, code: result.code, message: result.message };
    }
    if (action.type === "APPLY_INCOME_TICK") {
        const result = applyIncomeTicks(room, action.simulationTimeMs);
        return result.valid
            ? { action: action.type, applied: true, code: "valid", message: result.message, incomeTicksApplied: result.ticksApplied }
            : { action: action.type, applied: false, code: result.code, message: result.message };
    }
    if (action.type === "POP_BALLOON") {
        const damage = damageBalloon(room, action.balloonId);
        return damage
            ? { action: action.type, applied: true, code: "valid", message: damage.popped ? "Balloon popped" : "Balloon damaged", damage }
            : { action: action.type, applied: false, code: "not_found", message: "Select an active balloon" };
    }
    if (action.type === "PLACE_WALL") {
        const validation = validateWallPlacement(room, action.wall);
        if (!validation.valid)
            return validationResult(action.type, validation);
        const cost = action.wall.orientation === "vertical" ? VERTICAL_WALL_COST : HORIZONTAL_WALL_COST;
        if (room.economy.coins < cost)
            return insufficientCoins(action.type, cost);
        room.economy.coins -= cost;
        return validationResult(action.type, placeWall(room, action.wall));
    }
    if (action.type === "PLACE_NAILS") {
        const validation = validateNailPlacement(room, action.wallSegmentId);
        if (!validation.valid)
            return validationResult(action.type, validation);
        if (room.economy.coins < NAIL_STRIP_COST)
            return insufficientCoins(action.type, NAIL_STRIP_COST);
        room.economy.coins -= NAIL_STRIP_COST;
        return validationResult(action.type, placeNailStrip(room, action.wallSegmentId));
    }
    if (action.type === "REMOVE_NAILS")
        return validationResult(action.type, removeNailStrip(room, action.wallSegmentId));
    const armed = room.nailStrips.some((nail) => nail.wallSegmentId === action.wallSegmentId);
    if (armed)
        return validationResult(action.type, removeNailStrip(room, action.wallSegmentId), "Nails removed; wall remains");
    return validationResult(action.type, removeWall(room, action.wallSegmentId));
}
function insufficientCoins(action, cost) {
    return { action, applied: false, code: "insufficient_coins", message: `Not enough Coins (need ${cost})` };
}
function validationResult(action, result, successMessage = result.message) {
    return result.valid
        ? { action, applied: true, code: "valid", message: successMessage }
        : { action, applied: false, code: result.code, message: result.message };
}
//# sourceMappingURL=actions.js.map