export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone';
export type FurnitureKind = 'bed' | 'table' | 'chair' | 'sofa';
export type ShapeKind = PrimitiveKind | FurnitureKind;
export type ViewMode = 'perspective' | 'top';
export type Theme = 'default' | 'blueprint';
export type TransformMode = 'move' | 'scale';

export type Shape = {
  id: string;
  kind: ShapeKind;
  color: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  roomId: string;
};

export type RoomPoint = { x: number; z: number };
export type OpeningKind = 'door' | 'window';
export type Opening = {
  id: string;
  kind: OpeningKind;
  edgeIdx: number;
  position: number;
  width: number;
  bottom: number;
  height: number;
};
export type Room = {
  id: string;
  name: string;
  points: RoomPoint[];
  closed: boolean;
  wallHeights?: number[];
  openings?: Opening[];
  floorId: string;
};

export type Floor = {
  id: string;
  name: string;
};

export const DEFAULT_WALL_HEIGHT = 2.4;
export const MIN_WALL_HEIGHT = 0.2;
export const DOOR_DEFAULT = { width: 0.9, bottom: 0, height: 2.1 };
export const WINDOW_DEFAULT = { width: 1.2, bottom: 0.9, height: 1.3 };

const palette = ['#1a1300', '#ff5722', '#0ea5e9', '#16a34a', '#a855f7', '#ec4899'];

function kindBaseOffset(kind: ShapeKind): number {
  switch (kind) {
    case 'box':
      return 0.5;
    case 'sphere':
      return 0.6;
    case 'cylinder':
      return 0.6;
    case 'cone':
      return 0.6;
    case 'torus':
      return 0.7;
    case 'bed':
    case 'table':
    case 'chair':
    case 'sofa':
      return 0;
  }
}

function makeShape(kind: ShapeKind, roomId: string): Shape {
  return {
    id: crypto.randomUUID(),
    kind,
    color: palette[Math.floor(Math.random() * palette.length)],
    position: {
      x: (Math.random() - 0.5) * 2,
      y: kindBaseOffset(kind),
      z: (Math.random() - 0.5) * 2
    },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    roomId
  };
}

const STORAGE_KEY = 'threejs-svelte:studio:v1';

function sanitizeRooms(input: unknown, indexBase = 1): Room[] {
  if (!Array.isArray(input)) return [];
  const out: Room[] = [];
  let idx = indexBase;
  for (const r of input) {
    if (!r) continue;
    const points: RoomPoint[] = [];
    if (Array.isArray(r.points)) {
      for (const p of r.points) {
        const x = Number(p?.x);
        const z = Number(p?.z);
        if (Number.isFinite(x) && Number.isFinite(z)) points.push({ x, z });
      }
    }
    let wallHeights: number[] | undefined = undefined;
    if (Array.isArray(r.wallHeights)) {
      const arr: number[] = [];
      for (const h of r.wallHeights) {
        const n = Number(h);
        arr.push(Number.isFinite(n) && n >= 0 ? n : DEFAULT_WALL_HEIGHT);
      }
      wallHeights = arr;
    }
    let openings: Opening[] | undefined = undefined;
    if (Array.isArray(r.openings)) {
      openings = [];
      for (const o of r.openings) {
        if (!o) continue;
        const kind = o.kind === 'window' ? 'window' : o.kind === 'door' ? 'door' : null;
        if (!kind) continue;
        const edgeIdx = Number(o.edgeIdx);
        const position = Number(o.position);
        const width = Number(o.width);
        const bottom = Number(o.bottom);
        const height = Number(o.height);
        if (
          !Number.isFinite(edgeIdx) ||
          !Number.isFinite(position) ||
          !Number.isFinite(width) ||
          !Number.isFinite(bottom) ||
          !Number.isFinite(height)
        )
          continue;
        openings.push({
          id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
          kind,
          edgeIdx,
          position,
          width,
          bottom,
          height
        });
      }
    }
    out.push({
      id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
      name: typeof r.name === 'string' && r.name.trim() ? r.name : `Habitación ${idx}`,
      points,
      closed: r.closed === true,
      wallHeights,
      openings,
      floorId: typeof r.floorId === 'string' ? r.floorId : ''
    });
    idx++;
  }
  return out;
}

type LoadedState = {
  shapes: Shape[];
  selectedId: string | null;
  viewMode: ViewMode;
  rooms: Room[];
  floors: Floor[];
  theme: Theme;
  activeRoomId: string | null;
  activeFloorId: string | null;
  projectName: string;
};

function sanitizeFloors(input: unknown): Floor[] {
  if (!Array.isArray(input)) return [];
  const out: Floor[] = [];
  let i = 0;
  for (const f of input) {
    if (!f) continue;
    out.push({
      id: typeof f.id === 'string' ? f.id : crypto.randomUUID(),
      name: typeof f.name === 'string' && f.name.trim() ? f.name : i === 0 ? 'Planta baja' : `Piso ${i}`
    });
    i++;
  }
  return out;
}

function migrate(parsed: {
  shapes?: unknown;
  selectedId?: unknown;
  viewMode?: unknown;
  rooms?: unknown;
  floors?: unknown;
  theme?: unknown;
  activeRoomId?: unknown;
  activeFloorId?: unknown;
  projectName?: unknown;
}): LoadedState {
  const rooms = sanitizeRooms(parsed.rooms);
  let floors = sanitizeFloors(parsed.floors);

  const validKinds: ShapeKind[] = [
    'box',
    'sphere',
    'cylinder',
    'torus',
    'cone',
    'bed',
    'table',
    'chair',
    'sofa'
  ];
  const rawShapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
  const shapes: Shape[] = [];
  for (const s of rawShapes) {
    if (!s || !validKinds.includes(s.kind)) continue;
    shapes.push({
      id: typeof s.id === 'string' ? s.id : crypto.randomUUID(),
      kind: s.kind,
      color: typeof s.color === 'string' ? s.color : '#1a1300',
      position: {
        x: Number(s.position?.x) || 0,
        y: Number(s.position?.y) || 0,
        z: Number(s.position?.z) || 0
      },
      scale: {
        x: Number(s.scale?.x) || 1,
        y: Number(s.scale?.y) || 1,
        z: Number(s.scale?.z) || 1
      },
      rotation: {
        x: Number(s.rotation?.x) || 0,
        y: Number(s.rotation?.y) || 0,
        z: Number(s.rotation?.z) || 0
      },
      roomId: typeof s.roomId === 'string' ? s.roomId : ''
    });
  }

  if (shapes.length > 0 && rooms.length === 0) {
    rooms.push({
      id: crypto.randomUUID(),
      name: 'Habitación 1',
      points: [],
      closed: false,
      floorId: ''
    });
  }

  // Ensure a default floor exists if there are rooms
  if (floors.length === 0 && rooms.length > 0) {
    floors = [{ id: crypto.randomUUID(), name: 'Planta baja' }];
  }
  const validFloorIds = new Set(floors.map((f) => f.id));
  const fallbackFloorId = floors[0]?.id ?? null;
  for (const r of rooms) {
    if (!r.floorId || !validFloorIds.has(r.floorId)) {
      if (fallbackFloorId) r.floorId = fallbackFloorId;
    }
  }

  const validRoomIds = new Set(rooms.map((r) => r.id));
  const fallbackRoomId = rooms[0]?.id ?? null;
  for (const s of shapes) {
    if (!s.roomId || !validRoomIds.has(s.roomId)) {
      if (fallbackRoomId) s.roomId = fallbackRoomId;
    }
  }

  let activeRoomId: string | null =
    typeof parsed.activeRoomId === 'string' && validRoomIds.has(parsed.activeRoomId)
      ? parsed.activeRoomId
      : (rooms[0]?.id ?? null);

  let activeFloorId: string | null =
    typeof parsed.activeFloorId === 'string' && validFloorIds.has(parsed.activeFloorId)
      ? parsed.activeFloorId
      : (floors[0]?.id ?? null);

  // If the active room belongs to a different floor, switch active floor accordingly
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  if (activeRoom && validFloorIds.has(activeRoom.floorId)) {
    activeFloorId = activeRoom.floorId;
  }

  return {
    shapes,
    selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : null,
    viewMode: parsed.viewMode === 'top' ? 'top' : 'perspective',
    rooms,
    floors,
    theme: parsed.theme === 'blueprint' ? 'blueprint' : 'default',
    activeRoomId,
    activeFloorId,
    projectName:
      typeof parsed.projectName === 'string' && parsed.projectName.trim()
        ? parsed.projectName
        : ''
  };
}

function loadInitial(): LoadedState {
  const fallback: LoadedState = {
    shapes: [],
    selectedId: null,
    viewMode: 'perspective',
    rooms: [],
    floors: [],
    theme: 'default',
    activeRoomId: null,
    activeFloorId: null,
    projectName: ''
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return fallback;
  }
}

function nextRoomName(existing: Room[]): string {
  const used = new Set(existing.map((r) => r.name));
  let i = existing.length + 1;
  while (used.has(`Habitación ${i}`)) i++;
  return `Habitación ${i}`;
}

function nextFloorName(existing: Floor[]): string {
  const used = new Set(existing.map((f) => f.name));
  if (existing.length === 0 && !used.has('Planta baja')) return 'Planta baja';
  let i = existing.length;
  if (i === 0) i = 1;
  while (used.has(`Piso ${i}`)) i++;
  return `Piso ${i}`;
}

function createStudio() {
  const initial = loadInitial();
  let shapes = $state<Shape[]>(initial.shapes);
  let selectedId = $state<string | null>(initial.selectedId);
  let viewMode = $state<ViewMode>(initial.viewMode);
  let rooms = $state<Room[]>(initial.rooms);
  let floors = $state<Floor[]>(initial.floors);
  let drawingRoomId = $state<string | null>(null);
  let mandatoryContour = $state<boolean>(false);
  let theme = $state<Theme>(initial.theme);
  let activeRoomId = $state<string | null>(initial.activeRoomId);
  let activeFloorId = $state<string | null>(initial.activeFloorId);
  let editingFloorId = $state<string | null>(null);
  let projectName = $state<string>(initial.projectName);

  function ensureDefaultFloor(): string {
    if (floors.length === 0) {
      const id = crypto.randomUUID();
      floors.push({ id, name: 'Planta baja' });
      activeFloorId = id;
      return id;
    }
    if (!activeFloorId || !floors.some((f) => f.id === activeFloorId)) {
      activeFloorId = floors[0].id;
    }
    return activeFloorId!;
  }
  let editingRoomId = $state<string | null>(null);
  let isCreatingNewRoom = $state<boolean>(false);
  let editingProject = $state<boolean>(false);
  let editingContourRoomId = $state<string | null>(null);
  let contourBackup: RoomPoint[] | null = null;
  let furnishingRoomId = $state<string | null>(null);
  let transformMode = $state<TransformMode>('move');
  let wallsRoomId = $state<string | null>(null);
  let selectedWallEdge = $state<number | null>(null);
  let selectedOpeningId = $state<string | null>(null);
  let mandatoryWalls = $state<boolean>(false);

  function enterWallsMode(roomId: string, mandatory: boolean) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !room.closed) return;
    if (!room.wallHeights || room.wallHeights.length !== room.points.length) {
      room.wallHeights = room.points.map(() => MIN_WALL_HEIGHT);
    } else {
      for (let i = 0; i < room.wallHeights.length; i++) {
        if (room.wallHeights[i] < MIN_WALL_HEIGHT) room.wallHeights[i] = MIN_WALL_HEIGHT;
      }
    }
    activeRoomId = roomId;
    wallsRoomId = roomId;
    selectedWallEdge = null;
    viewMode = 'perspective';
    mandatoryWalls = mandatory;
  }

  if (typeof window !== 'undefined') {
    $effect.root(() => {
      $effect(() => {
        // persist closed rooms + rooms even if open are still valid sets (no contour yet)
        const snapshot = JSON.stringify({
          shapes,
          selectedId,
          viewMode,
          rooms,
          floors,
          theme,
          activeRoomId,
          activeFloorId,
          projectName
        });
        try {
          localStorage.setItem(STORAGE_KEY, snapshot);
        } catch {
          // quota exceeded or storage disabled — ignore
        }
      });
    });
  }

  return {
    get shapes() {
      return shapes;
    },
    get selectedId() {
      return selectedId;
    },
    get selected() {
      return shapes.find((s) => s.id === selectedId) ?? null;
    },
    get viewMode() {
      return viewMode;
    },
    setView(mode: ViewMode) {
      viewMode = mode;
    },
    get theme() {
      return theme;
    },
    setTheme(t: Theme) {
      theme = t;
    },
    get projectName() {
      return projectName;
    },
    setProjectName(name: string) {
      const trimmed = name.trim();
      if (trimmed) projectName = trimmed;
    },
    add(kind: ShapeKind) {
      if (!activeRoomId) return;
      const shape = makeShape(kind, activeRoomId);
      shapes.push(shape);
      selectedId = shape.id;
    },
    addAt(kind: ShapeKind, x: number, z: number) {
      if (!activeRoomId) return;
      const shape = makeShape(kind, activeRoomId);
      shape.position.x = x;
      shape.position.z = z;
      shapes.push(shape);
      selectedId = shape.id;
    },
    select(id: string | null) {
      selectedId = id;
    },
    remove(id: string) {
      shapes = shapes.filter((s) => s.id !== id);
      if (selectedId === id) selectedId = null;
    },
    clear() {
      shapes = [];
      selectedId = null;
    },
    moveShape(shapeId: string, roomId: string) {
      const shape = shapes.find((s) => s.id === shapeId);
      const target = rooms.find((r) => r.id === roomId);
      if (!shape || !target) return;
      shape.roomId = roomId;
    },
    get rooms() {
      return rooms;
    },
    get activeRoomId() {
      return activeRoomId;
    },
    get activeRoom() {
      return rooms.find((r) => r.id === activeRoomId) ?? null;
    },
    setActiveRoom(id: string | null) {
      if (id === null) {
        activeRoomId = null;
        return;
      }
      const room = rooms.find((r) => r.id === id);
      if (!room) return;
      activeRoomId = id;
      if (room.floorId) activeFloorId = room.floorId;
    },
    createRoom(): string {
      const floorId = ensureDefaultFloor();
      const id = crypto.randomUUID();
      rooms.push({
        id,
        name: nextRoomName(rooms),
        points: [],
        closed: false,
        floorId
      });
      activeRoomId = id;
      activeFloorId = floorId;
      return id;
    },
    createAndEditRoom(): string | null {
      if (drawingRoomId || editingRoomId !== null) return null;
      const floorId = ensureDefaultFloor();
      const id = crypto.randomUUID();
      rooms.push({
        id,
        name: nextRoomName(rooms),
        points: [],
        closed: false,
        floorId
      });
      activeRoomId = id;
      activeFloorId = floorId;
      editingRoomId = id;
      isCreatingNewRoom = true;
      return id;
    },
    get floors() {
      return floors;
    },
    get activeFloorId() {
      return activeFloorId;
    },
    get activeFloor() {
      return floors.find((f) => f.id === activeFloorId) ?? null;
    },
    setActiveFloor(id: string | null) {
      if (id === null) {
        activeFloorId = null;
        return;
      }
      if (floors.some((f) => f.id === id)) activeFloorId = id;
    },
    createFloor(): string {
      const id = crypto.randomUUID();
      floors.push({ id, name: nextFloorName(floors) });
      activeFloorId = id;
      return id;
    },
    renameFloor(id: string, name: string) {
      const floor = floors.find((f) => f.id === id);
      if (!floor) return;
      const trimmed = name.trim();
      if (trimmed) floor.name = trimmed;
    },
    removeFloor(id: string) {
      if (floors.length <= 1) return;
      const remainingRoomIds = new Set(
        rooms.filter((r) => r.floorId !== id).map((r) => r.id)
      );
      shapes = shapes.filter((s) => remainingRoomIds.has(s.roomId));
      rooms = rooms.filter((r) => r.floorId !== id);
      floors = floors.filter((f) => f.id !== id);
      if (activeFloorId === id) activeFloorId = floors[0]?.id ?? null;
      if (activeRoomId && !rooms.some((r) => r.id === activeRoomId)) {
        activeRoomId = rooms[0]?.id ?? null;
      }
      if (selectedId && !shapes.some((s) => s.id === selectedId)) selectedId = null;
    },
    moveRoomToFloor(roomId: string, floorId: string) {
      const room = rooms.find((r) => r.id === roomId);
      const floor = floors.find((f) => f.id === floorId);
      if (!room || !floor) return;
      room.floorId = floorId;
    },
    get editingFloorId() {
      return editingFloorId;
    },
    setEditingFloorId(id: string | null) {
      editingFloorId = id;
    },
    get editingRoomId() {
      return editingRoomId;
    },
    setEditingRoomId(id: string | null) {
      editingRoomId = id;
    },
    get isCreatingNewRoom() {
      return isCreatingNewRoom;
    },
    setIsCreatingNewRoom(v: boolean) {
      isCreatingNewRoom = v;
    },
    get editingProject() {
      return editingProject;
    },
    setEditingProject(v: boolean) {
      editingProject = v;
    },
    get editingContourRoomId() {
      return editingContourRoomId;
    },
    get editingContourRoom() {
      return rooms.find((r) => r.id === editingContourRoomId) ?? null;
    },
    startEditingContour(roomId: string) {
      if (drawingRoomId || editingContourRoomId) return;
      const room = rooms.find((r) => r.id === roomId);
      if (!room || room.points.length < 2) return;
      contourBackup = room.points.map((p) => ({ ...p }));
      activeRoomId = roomId;
      editingContourRoomId = roomId;
    },
    updateRoomPoint(roomId: string, index: number, x: number, z: number) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || index < 0 || index >= room.points.length) return;
      room.points[index].x = x;
      room.points[index].z = z;
    },
    insertRoomPoint(roomId: string, index: number, x: number, z: number) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || index < 0 || index > room.points.length) return;
      room.points.splice(index, 0, { x, z });
    },
    mergeAndClose(roomId: string, removeIdx: number) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      if (removeIdx < 0 || removeIdx >= room.points.length) return;
      if (room.points.length < 4) return;
      room.points.splice(removeIdx, 1);
      room.closed = true;
    },
    splitRoomNode(roomId: string, nodeIdx: number, towardNext: boolean): number {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return -1;
      const N = room.points.length;
      if (nodeIdx < 0 || nodeIdx >= N) return -1;
      const node = room.points[nodeIdx];
      const next: RoomPoint[] = [];
      if (towardNext) {
        next.push({ x: node.x, z: node.z }); // B' (dragged) at start
        for (let k = nodeIdx + 1; k < N; k++) next.push({ ...room.points[k] });
        for (let k = 0; k < nodeIdx; k++) next.push({ ...room.points[k] });
        next.push({ x: node.x, z: node.z }); // B (anchored) at end
        room.points = next;
        room.closed = false;
        return 0;
      } else {
        next.push({ x: node.x, z: node.z }); // B (anchored) at start
        for (let k = nodeIdx + 1; k < N; k++) next.push({ ...room.points[k] });
        for (let k = 0; k < nodeIdx; k++) next.push({ ...room.points[k] });
        next.push({ x: node.x, z: node.z }); // B' (dragged) at end
        room.points = next;
        room.closed = false;
        return next.length - 1;
      }
    },
    finishEditingContour() {
      const room = rooms.find((r) => r.id === editingContourRoomId);
      if (room && !room.closed) return false;
      contourBackup = null;
      editingContourRoomId = null;
      return true;
    },
    cancelEditingContour() {
      if (!editingContourRoomId) return;
      const room = rooms.find((r) => r.id === editingContourRoomId);
      if (room && contourBackup) {
        room.points = contourBackup.map((p) => ({ ...p }));
      }
      contourBackup = null;
      editingContourRoomId = null;
    },
    get furnishingRoomId() {
      return furnishingRoomId;
    },
    get furnishingRoom() {
      return rooms.find((r) => r.id === furnishingRoomId) ?? null;
    },
    startFurnishing(roomId: string) {
      if (drawingRoomId || editingContourRoomId) return;
      const room = rooms.find((r) => r.id === roomId);
      if (!room || !room.closed) return;
      activeRoomId = roomId;
      furnishingRoomId = roomId;
      viewMode = 'perspective';
    },
    stopFurnishing() {
      furnishingRoomId = null;
    },
    get wallsRoomId() {
      return wallsRoomId;
    },
    get wallsRoom() {
      return rooms.find((r) => r.id === wallsRoomId) ?? null;
    },
    get selectedWallEdge() {
      return selectedWallEdge;
    },
    selectWallEdge(idx: number | null) {
      selectedWallEdge = idx;
      selectedOpeningId = null;
    },
    get selectedOpeningId() {
      return selectedOpeningId;
    },
    get selectedOpening() {
      const room = rooms.find((r) => r.id === wallsRoomId);
      if (!room || !room.openings) return null;
      return room.openings.find((o) => o.id === selectedOpeningId) ?? null;
    },
    selectOpening(id: string | null) {
      selectedOpeningId = id;
    },
    updateOpening(
      roomId: string,
      openingId: string,
      p: { position?: number; bottom?: number; width?: number; height?: number }
    ) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || !room.openings) return;
      const op = room.openings.find((o) => o.id === openingId);
      if (!op) return;
      const N = room.points.length;
      const a = room.points[op.edgeIdx];
      const b = room.points[(op.edgeIdx + 1) % N];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const wallH = room.wallHeights?.[op.edgeIdx] ?? DEFAULT_WALL_HEIGHT;
      const MIN_DIM = 0.2;
      const MARGIN = 0.05;

      let width = p.width ?? op.width;
      let height = p.height ?? op.height;
      let position = p.position ?? op.position;
      let bottom = p.bottom ?? op.bottom;

      width = Math.max(MIN_DIM, Math.min(L - 2 * MARGIN, width));
      height = Math.max(MIN_DIM, Math.min(wallH - MARGIN, height));
      bottom = Math.max(0, Math.min(wallH - MARGIN - height, bottom));
      position = Math.max(MARGIN, Math.min(L - MARGIN - width, position));

      op.width = width;
      op.height = height;
      op.bottom = bottom;
      op.position = position;
    },
    get mandatoryWalls() {
      return mandatoryWalls;
    },
    startWalls(roomId: string) {
      if (drawingRoomId || editingContourRoomId || furnishingRoomId) return;
      enterWallsMode(roomId, false);
    },
    stopWalls() {
      wallsRoomId = null;
      selectedWallEdge = null;
      selectedOpeningId = null;
      mandatoryWalls = false;
    },
    addOpening(roomId: string, edgeIdx: number, kind: OpeningKind): string | null {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || !room.closed) return null;
      const N = room.points.length;
      if (edgeIdx < 0 || edgeIdx >= N) return null;
      const a = room.points[edgeIdx];
      const b = room.points[(edgeIdx + 1) % N];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const wallH = room.wallHeights?.[edgeIdx] ?? DEFAULT_WALL_HEIGHT;
      const def = kind === 'door' ? DOOR_DEFAULT : WINDOW_DEFAULT;
      const width = Math.min(def.width, Math.max(0.1, L - 0.2));
      if (width < 0.1) return null;
      const top = def.bottom + def.height;
      let bottom = def.bottom;
      let height = def.height;
      if (top > wallH - 0.05) {
        height = Math.max(0.1, wallH - bottom - 0.05);
        if (height < 0.1) {
          bottom = 0;
          height = Math.max(0.1, wallH - 0.05);
        }
      }
      const op: Opening = {
        id: crypto.randomUUID(),
        kind,
        edgeIdx,
        position: (L - width) / 2,
        width,
        bottom,
        height
      };
      if (!room.openings) room.openings = [];
      room.openings.push(op);
      return op.id;
    },
    removeOpening(roomId: string, openingId: string) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || !room.openings) return;
      room.openings = room.openings.filter((o) => o.id !== openingId);
      if (selectedOpeningId === openingId) selectedOpeningId = null;
    },
    setWallHeight(roomId: string, edgeIdx: number | null, height: number) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || !room.wallHeights) return;
      const clamped = Math.max(MIN_WALL_HEIGHT, Math.min(10, height));
      if (edgeIdx === null) {
        for (let i = 0; i < room.wallHeights.length; i++) room.wallHeights[i] = clamped;
      } else if (edgeIdx >= 0 && edgeIdx < room.wallHeights.length) {
        room.wallHeights[edgeIdx] = clamped;
      }
    },
    get transformMode() {
      return transformMode;
    },
    setTransformMode(m: TransformMode) {
      transformMode = m;
    },
    reorderRooms(fromIdx: number, toIdx: number) {
      if (fromIdx < 0 || fromIdx >= rooms.length) return;
      if (toIdx < 0 || toIdx >= rooms.length) return;
      if (fromIdx === toIdx) return;
      const next = rooms.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      rooms = next;
    },
    moveRoomTo(roomId: string, targetFloorId: string, beforeRoomId: string | null) {
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return;
      if (!floors.some((f) => f.id === targetFloorId)) return;
      const next = rooms.slice();
      const [moved] = next.splice(idx, 1);
      moved.floorId = targetFloorId;
      let insertIdx: number;
      if (beforeRoomId === null) {
        insertIdx = next.length;
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].floorId === targetFloorId) {
            insertIdx = i + 1;
            break;
          }
        }
      } else {
        insertIdx = next.findIndex((r) => r.id === beforeRoomId);
        if (insertIdx === -1) insertIdx = next.length;
      }
      next.splice(insertIdx, 0, moved);
      rooms = next;
    },
    renameRoom(id: string, name: string) {
      const room = rooms.find((r) => r.id === id);
      if (!room) return;
      const trimmed = name.trim();
      if (trimmed) room.name = trimmed;
    },
    get drawingRoomId() {
      return drawingRoomId;
    },
    get drawingRoom() {
      return rooms.find((r) => r.id === drawingRoomId) ?? null;
    },
    get mandatoryContour() {
      return mandatoryContour;
    },
    startDrawingRoom(opts: { mandatory?: boolean } = {}) {
      if (drawingRoomId) return;
      let target = activeRoomId;
      if (!target) {
        const floorId = ensureDefaultFloor();
        target = crypto.randomUUID();
        rooms.push({
          id: target,
          name: nextRoomName(rooms),
          points: [],
          closed: false,
          floorId
        });
        activeRoomId = target;
        activeFloorId = floorId;
      } else {
        const r = rooms.find((x) => x.id === target);
        if (r) {
          r.points = [];
          r.closed = false;
        }
      }
      drawingRoomId = target;
      mandatoryContour = !!opts.mandatory;
    },
    addRoomPoint(x: number, z: number) {
      const room = rooms.find((r) => r.id === drawingRoomId);
      if (!room || room.closed) return;
      room.points.push({ x, z });
    },
    closeDrawingRoom(): boolean {
      const room = rooms.find((r) => r.id === drawingRoomId);
      if (!room) return false;
      if (room.points.length < 3) {
        // not enough — leave the set but reset contour
        room.points = [];
        room.closed = false;
        drawingRoomId = null;
        return false;
      }
      room.closed = true;
      const closedRoomId = drawingRoomId;
      const wasMandatory = mandatoryContour;
      drawingRoomId = null;
      mandatoryContour = false;
      if (wasMandatory && closedRoomId) {
        enterWallsMode(closedRoomId, true);
      }
      return true;
    },
    cancelDrawingRoom() {
      if (!drawingRoomId) return;
      const id = drawingRoomId;
      if (mandatoryContour) {
        // mandatory flow: cancel deletes the entire draft room
        rooms = rooms.filter((r) => r.id !== id);
        shapes = shapes.filter((s) => s.roomId !== id);
        if (activeRoomId === id) activeRoomId = rooms[0]?.id ?? null;
        if (selectedId && !shapes.some((s) => s.id === selectedId)) selectedId = null;
        drawingRoomId = null;
        mandatoryContour = false;
        return;
      }
      const room = rooms.find((r) => r.id === id);
      if (room) {
        room.points = [];
        room.closed = false;
      }
      drawingRoomId = null;
    },
    removeRoom(id: string) {
      rooms = rooms.filter((r) => r.id !== id);
      shapes = shapes.filter((s) => s.roomId !== id);
      if (drawingRoomId === id) drawingRoomId = null;
      if (activeRoomId === id) activeRoomId = rooms[0]?.id ?? null;
      if (selectedId && !shapes.some((s) => s.id === selectedId)) selectedId = null;
    },
    serialize(): string {
      return JSON.stringify({ version: 3, shapes, rooms, activeRoomId }, null, 2);
    },
    load(raw: unknown): { ok: true; count: number } | { ok: false; error: string } {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || (!Array.isArray(data.shapes) && !Array.isArray(data.rooms))) {
          return { ok: false, error: 'JSON inválido: faltan "shapes" o "rooms".' };
        }
        const migrated = migrate(data);
        shapes = migrated.shapes;
        rooms = migrated.rooms;
        selectedId = null;
        drawingRoomId = null;
        activeRoomId = migrated.activeRoomId;
        return { ok: true, count: migrated.shapes.length };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Error al parsear JSON.' };
      }
    }
  };
}

export const studio = createStudio();
