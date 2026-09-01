export type BalloonStatus = "active" | "popped" | "escaped";
export type SpawnLane = 1 | 2 | 3 | 4;
export type PathBias = "left" | "right";
export type WallOrientation = "vertical" | "horizontal";
export type NailStatus = "active" | "broken";
export type NailStripStatus = NailStatus;
export type BalloonType = "basic";

export type GridPosition = { column: number; row: number };
export type GridCell = GridPosition;
export type GridEdge = { orientation: WallOrientation; gridX: number; gridY: number };

export type WallSegment = GridEdge & { id: string; roomId: string };
export type NailStrip = {
  id: string;
  roomId: string;
  wallSegmentId: string;
  durability: number;
  maxDurability: number;
  status: NailStatus;
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
  status: BalloonStatus;
  spawnLane: SpawnLane;
  pathBias: PathBias;
  currentCell: GridCell;
  targetCell: GridCell | null;
  path: GridCell[];
  pathRevision: number;
  contactingNailIds: string[];
};

export type RoomState = {
  id: string;
  health: number;
  maxHealth: number;
  balloons: Balloon[];
  processedSendIds: string[];
  walls: WallSegment[];
  nailStrips: NailStrip[];
  wallRevision: number;
  width: number;
  height: number;
};
export type BalloonRoom = RoomState;

export type BalloonSimulationEvent =
  | { type: "balloon_popped"; balloon: Balloon }
  | { type: "balloon_escaped"; balloon: Balloon; damage: number }
  | {
      type: "nail_contact";
      balloonId: string;
      nailStripId: string;
      wallSegmentId: string;
      balloonHealthBefore: number;
      balloonHealthAfter: number;
      durabilityBefore: number;
      durabilityAfter: number;
      popped: boolean;
    };

export type BalloonDamageResult = { balloonId: string; remainingHealth: number; popped: boolean };
export type WallValidationCode = "valid" | "invalid_edge" | "duplicate" | "budget_reached" | "needs_support" | "path_required" | "supporting_span" | "not_found";
export type WallValidationResult = { valid: boolean; code: WallValidationCode; message: string };
export type NailValidationCode = "valid" | "wall_required" | "duplicate" | "limit_reached" | "not_found";
export type NailValidationResult = { valid: boolean; code: NailValidationCode; message: string };

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

export type GameAction =
  | { type: "PLACE_WALL"; wall: WallSegment }
  | { type: "REMOVE_WALL"; wallSegmentId: string }
  | { type: "PLACE_NAILS"; wallSegmentId: string }
  | { type: "REMOVE_NAILS"; wallSegmentId: string }
  | { type: "POP_BALLOON"; balloonId: string }
  | SendBalloonAction;

export type GameActionResult =
  | { action: GameAction["type"]; applied: true; code: "valid"; message: string; damage?: BalloonDamageResult; spawnedBalloon?: Balloon }
  | { action: GameAction["type"]; applied: false; code: string; message: string };

export type SendBalloonValidationCode = "valid" | "invalid_lane" | "target_not_found" | "room_closed" | "invalid_balloon_type" | "duplicate_balloon_id" | "invalid_identity" | "invalid_metadata" | "path_unavailable";
export type SendBalloonResult = {
  valid: boolean;
  code: SendBalloonValidationCode;
  message: string;
  balloon?: Balloon;
};
