import { placeNailStrip, removeNailStrip } from "./nails.js";
import { sendBalloon } from "./offense.js";
import { damageBalloon } from "./simulation.js";
import { placeWall, removeWall } from "./walls.js";
export function applyGameAction(room, action) {
    if (action.type === "SEND_BALLOON") {
        const result = sendBalloon(room, action);
        return result.valid && result.balloon
            ? { action: action.type, applied: true, code: "valid", message: result.message, spawnedBalloon: result.balloon }
            : { action: action.type, applied: false, code: result.code, message: result.message };
    }
    if (action.type === "POP_BALLOON") {
        const damage = damageBalloon(room, action.balloonId);
        return damage
            ? { action: action.type, applied: true, code: "valid", message: damage.popped ? "Balloon popped" : "Balloon damaged", damage }
            : { action: action.type, applied: false, code: "not_found", message: "Select an active balloon" };
    }
    if (action.type === "PLACE_WALL")
        return validationResult(action.type, placeWall(room, action.wall));
    if (action.type === "PLACE_NAILS")
        return validationResult(action.type, placeNailStrip(room, action.wallSegmentId));
    if (action.type === "REMOVE_NAILS")
        return validationResult(action.type, removeNailStrip(room, action.wallSegmentId));
    const armed = room.nailStrips.some((nail) => nail.wallSegmentId === action.wallSegmentId);
    if (armed)
        return validationResult(action.type, removeNailStrip(room, action.wallSegmentId), "Nails removed; wall remains");
    return validationResult(action.type, removeWall(room, action.wallSegmentId));
}
function validationResult(action, result, successMessage = result.message) {
    return result.valid
        ? { action, applied: true, code: "valid", message: successMessage }
        : { action, applied: false, code: result.code, message: result.message };
}
//# sourceMappingURL=actions.js.map