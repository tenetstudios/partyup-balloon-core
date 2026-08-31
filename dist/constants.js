export const ROOM_MAX_HEALTH = 20;
export const GRID_WIDTH = 6;
export const GRID_HEIGHT = 10;
export const GRID_COLUMNS = GRID_WIDTH;
export const GRID_ROWS = GRID_HEIGHT;
export const ENTRY_LANES = [1, 2, 3, 4];
export const ENTRY_LANE_COLUMNS = { 1: 0, 2: 2, 3: 3, 4: 5 };
export const BASIC_BALLOON_HP = 3;
export const BASIC_BALLOON_SPEED = 0.105;
export const BASIC_BALLOON_RADIUS = 0.06;
export const BASIC_BALLOON_ROOM_DAMAGE = 1;
export const BASIC_BALLOON = {
    maxHealth: BASIC_BALLOON_HP,
    speed: BASIC_BALLOON_SPEED,
    radius: BASIC_BALLOON_RADIUS,
    roomDamage: BASIC_BALLOON_ROOM_DAMAGE,
};
export const MANUAL_POP_DAMAGE = 1;
export const MANUAL_TAP_DAMAGE = MANUAL_POP_DAMAGE;
export const MAX_WALL_SEGMENTS = 10;
export const MAX_HORIZONTAL_SUPPORT_DISTANCE = 2;
export const NAIL_DAMAGE = 1;
export const NAIL_MAX_DURABILITY = 10;
export const MAX_NAIL_STRIPS = 4;
export const DEV_SPAWN_MIN_SECONDS = 1.5;
export const DEV_SPAWN_MAX_SECONDS = 2.5;
export const SIMULATION_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 0.25;
//# sourceMappingURL=constants.js.map