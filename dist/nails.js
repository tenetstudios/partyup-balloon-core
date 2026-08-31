import { MAX_NAIL_STRIPS, NAIL_MAX_DURABILITY } from "./constants.js";
export function createNailStrip(roomId, wallSegmentId) {
    return { id: `${roomId}:nails:${wallSegmentId}`, roomId, wallSegmentId, durability: NAIL_MAX_DURABILITY, maxDurability: NAIL_MAX_DURABILITY, status: "active" };
}
export function validateNailPlacement(room, wallSegmentId) {
    if (!room.walls.some((wall) => wall.id === wallSegmentId))
        return { valid: false, code: "wall_required", message: "Nails need an existing wall" };
    if (room.nailStrips.some((nail) => nail.wallSegmentId === wallSegmentId))
        return { valid: false, code: "duplicate", message: "Wall already armed" };
    if (room.nailStrips.length >= MAX_NAIL_STRIPS)
        return { valid: false, code: "limit_reached", message: "Nail limit reached" };
    return { valid: true, code: "valid", message: "Nails attached" };
}
export function placeNailStrip(room, wallSegmentId) {
    const validation = validateNailPlacement(room, wallSegmentId);
    if (!validation.valid)
        return validation;
    room.nailStrips.push(createNailStrip(room.id, wallSegmentId));
    return validation;
}
export function removeNailStrip(room, wallSegmentId) {
    const index = room.nailStrips.findIndex((nail) => nail.wallSegmentId === wallSegmentId);
    if (index < 0)
        return { valid: false, code: "not_found", message: "Wall has no nails" };
    const removed = room.nailStrips[index];
    if (!removed)
        return { valid: false, code: "not_found", message: "Wall has no nails" };
    room.nailStrips.splice(index, 1);
    for (const balloon of room.balloons)
        balloon.contactingNailIds = balloon.contactingNailIds.filter((id) => id !== removed.id);
    return { valid: true, code: "valid", message: "Nails removed" };
}
export function wallTouchesCell(wall, cell) {
    if (wall.orientation === "vertical")
        return wall.gridY === cell.row && (cell.column === wall.gridX - 1 || cell.column === wall.gridX);
    return wall.gridX === cell.column && (cell.row === wall.gridY - 1 || cell.row === wall.gridY);
}
export function getNailsTouchingCell(room, cell) {
    const wallIds = new Set(room.walls.filter((wall) => wallTouchesCell(wall, cell)).map((wall) => wall.id));
    return room.nailStrips.filter((nail) => wallIds.has(nail.wallSegmentId));
}
//# sourceMappingURL=nails.js.map