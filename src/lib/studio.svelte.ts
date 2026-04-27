export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone';
export type ViewMode = 'perspective' | 'top';
export type Theme = 'default' | 'blueprint';

export type Shape = {
  id: string;
  kind: PrimitiveKind;
  color: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  roomId: string;
};

export type RoomPoint = { x: number; z: number };
export type Room = {
  id: string;
  name: string;
  points: RoomPoint[];
  closed: boolean;
};

const palette = ['#1a1300', '#ff5722', '#0ea5e9', '#16a34a', '#a855f7', '#ec4899'];

function makeShape(kind: PrimitiveKind, roomId: string): Shape {
  return {
    id: crypto.randomUUID(),
    kind,
    color: palette[Math.floor(Math.random() * palette.length)],
    position: { x: (Math.random() - 0.5) * 2, y: 0, z: (Math.random() - 0.5) * 2 },
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
    out.push({
      id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
      name: typeof r.name === 'string' && r.name.trim() ? r.name : `Habitación ${idx}`,
      points,
      closed: r.closed === true
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
  theme: Theme;
  activeRoomId: string | null;
  projectName: string;
};

function migrate(parsed: {
  shapes?: unknown;
  selectedId?: unknown;
  viewMode?: unknown;
  rooms?: unknown;
  theme?: unknown;
  activeRoomId?: unknown;
  projectName?: unknown;
}): LoadedState {
  const rooms = sanitizeRooms(parsed.rooms);

  const validKinds: PrimitiveKind[] = ['box', 'sphere', 'cylinder', 'torus', 'cone'];
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
    rooms.push({ id: crypto.randomUUID(), name: 'Habitación 1', points: [], closed: false });
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

  return {
    shapes,
    selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : null,
    viewMode: parsed.viewMode === 'top' ? 'top' : 'perspective',
    rooms,
    theme: parsed.theme === 'blueprint' ? 'blueprint' : 'default',
    activeRoomId,
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
    theme: 'default',
    activeRoomId: null,
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

function createStudio() {
  const initial = loadInitial();
  let shapes = $state<Shape[]>(initial.shapes);
  let selectedId = $state<string | null>(initial.selectedId);
  let viewMode = $state<ViewMode>(initial.viewMode);
  let rooms = $state<Room[]>(initial.rooms);
  let drawingRoomId = $state<string | null>(null);
  let mandatoryContour = $state<boolean>(false);
  let theme = $state<Theme>(initial.theme);
  let activeRoomId = $state<string | null>(initial.activeRoomId);
  let projectName = $state<string>(initial.projectName);
  let editingRoomId = $state<string | null>(null);
  let isCreatingNewRoom = $state<boolean>(false);
  let editingProject = $state<boolean>(false);
  let editingContourRoomId = $state<string | null>(null);
  let contourBackup: RoomPoint[] | null = null;

  if (typeof window !== 'undefined') {
    $effect.root(() => {
      $effect(() => {
        // persist closed rooms + rooms even if open are still valid sets (no contour yet)
        const snapshot = JSON.stringify({
          shapes,
          selectedId,
          viewMode,
          rooms,
          theme,
          activeRoomId,
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
    add(kind: PrimitiveKind) {
      if (!activeRoomId) return;
      const shape = makeShape(kind, activeRoomId);
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
      if (rooms.some((r) => r.id === id)) activeRoomId = id;
    },
    createRoom(): string {
      const id = crypto.randomUUID();
      rooms.push({
        id,
        name: nextRoomName(rooms),
        points: [],
        closed: false
      });
      activeRoomId = id;
      return id;
    },
    createAndEditRoom(): string | null {
      if (drawingRoomId || editingRoomId !== null) return null;
      const id = crypto.randomUUID();
      rooms.push({
        id,
        name: nextRoomName(rooms),
        points: [],
        closed: false
      });
      activeRoomId = id;
      editingRoomId = id;
      isCreatingNewRoom = true;
      return id;
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
        target = crypto.randomUUID();
        rooms.push({ id: target, name: nextRoomName(rooms), points: [], closed: false });
        activeRoomId = target;
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
      drawingRoomId = null;
      mandatoryContour = false;
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
