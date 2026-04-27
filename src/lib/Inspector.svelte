<script lang="ts">
  import { studio, type ShapeKind, type Shape } from './studio.svelte';
  import { confirmStore } from './confirm.svelte';

  async function confirmRemove(shape: Shape) {
    const ok = await confirmStore.ask({
      title: 'Eliminar figura',
      message: `¿Eliminar la figura "${shape.kind}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (ok) studio.remove(shape.id);
  }
  async function confirmRemoveRoom(roomId: string) {
    const ok = await confirmStore.ask({
      title: 'Eliminar habitación',
      message: '¿Eliminar el contorno de esta habitación?',
      confirmText: 'Eliminar',
      danger: true
    });
    if (ok) studio.removeRoom(roomId);
  }
  function autofocus(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  function saveRoomName(id: string, value: string) {
    studio.renameRoom(id, value);
    const wasCreating = studio.isCreatingNewRoom;
    studio.setEditingRoomId(null);
    studio.setIsCreatingNewRoom(false);
    if (wasCreating) {
      studio.setView('top');
      studio.startDrawingRoom({ mandatory: true });
    }
  }

  function onCreateRoom() {
    studio.createAndEditRoom();
  }

  function onEditArea(roomId: string) {
    if (studio.drawingRoomId || studio.editingContourRoomId) return;
    studio.setView('top');
    studio.startEditingContour(roomId);
  }

  function onFurnish(roomId: string) {
    if (studio.drawingRoomId || studio.editingContourRoomId) return;
    studio.startFurnishing(roomId);
  }

  function onWalls(roomId: string) {
    if (studio.drawingRoomId || studio.editingContourRoomId || studio.furnishingRoomId) return;
    studio.startWalls(roomId);
  }

  let dragRoomId = $state<string | null>(null);
  let dragOverRoomId = $state<string | null>(null);
  let dragOverFloorId = $state<string | null>(null);

  function onRoomDragStart(e: DragEvent, roomId: string) {
    if (!e.dataTransfer) return;
    dragRoomId = roomId;
    e.dataTransfer.setData('application/x-room-id', roomId);
    e.dataTransfer.effectAllowed = 'move';
  }
  function onRoomDragOverItem(e: DragEvent, roomId: string) {
    if (!dragRoomId) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverRoomId = roomId;
    dragOverFloorId = null;
  }
  function onRoomDropItem(e: DragEvent, targetRoomId: string, targetFloorId: string) {
    e.preventDefault();
    e.stopPropagation();
    const fromId = e.dataTransfer?.getData('application/x-room-id') ?? dragRoomId;
    if (fromId && fromId !== targetRoomId) {
      studio.moveRoomTo(fromId, targetFloorId, targetRoomId);
    }
    dragRoomId = null;
    dragOverRoomId = null;
    dragOverFloorId = null;
  }
  function onFloorDragOver(e: DragEvent, floorId: string) {
    if (!dragRoomId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverFloorId = floorId;
  }
  function onFloorDrop(e: DragEvent, floorId: string) {
    e.preventDefault();
    const fromId = e.dataTransfer?.getData('application/x-room-id') ?? dragRoomId;
    if (fromId) {
      studio.moveRoomTo(fromId, floorId, null);
    }
    dragRoomId = null;
    dragOverRoomId = null;
    dragOverFloorId = null;
  }
  function onRoomDragEnd() {
    dragRoomId = null;
    dragOverRoomId = null;
    dragOverFloorId = null;
  }

  async function confirmRemoveFloor(floorId: string) {
    const f = studio.floors.find((x) => x.id === floorId);
    if (!f) return;
    const roomsHere = studio.rooms.filter((r) => r.floorId === floorId).length;
    const ok = await confirmStore.ask({
      title: 'Eliminar piso',
      message:
        roomsHere > 0
          ? `Se eliminará "${f.name}" junto con ${roomsHere} habitación${roomsHere === 1 ? '' : 'es'} y todos sus objetos. ¿Continuar?`
          : `¿Eliminar el piso "${f.name}"?`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (ok) studio.removeFloor(floorId);
  }

  function saveFloorName(id: string, value: string) {
    studio.renameFloor(id, value);
    studio.setEditingFloorId(null);
  }

  let collapsedFloors = $state<Set<string>>(new Set());
  function toggleFloor(id: string) {
    const next = new Set(collapsedFloors);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedFloors = next;
  }

  const primitiveKinds: { kind: ShapeKind; label: string; icon: string }[] = [
    { kind: 'box', label: 'Cubo', icon: '◼' },
    { kind: 'sphere', label: 'Esfera', icon: '●' },
    { kind: 'cylinder', label: 'Cilindro', icon: '▮' },
    { kind: 'cone', label: 'Cono', icon: '▲' },
    { kind: 'torus', label: 'Toro', icon: '◯' }
  ];

  const furnitureKinds: { kind: ShapeKind; label: string; icon: string }[] = [
    { kind: 'bed', label: 'Cama', icon: '🛏' },
    { kind: 'table', label: 'Mesa', icon: '▭' },
    { kind: 'chair', label: 'Silla', icon: '🪑' },
    { kind: 'sofa', label: 'Sofá', icon: '🛋' }
  ];

</script>

<aside class="panel">
  <div class="project-header">
    <h2 class="project-name">{studio.projectName}</h2>
    <button
      class="edit project-edit"
      onclick={() => studio.setEditingProject(true)}
      title="Renombrar proyecto"
      aria-label="Renombrar proyecto">✎</button
    >
  </div>

  <button
    class="new-room-btn"
    onclick={onCreateRoom}
    disabled={studio.editingRoomId !== null}
    title={studio.editingRoomId !== null
      ? 'Termina de nombrar la habitación actual'
      : 'Crear nueva habitación'}
  >
    <span class="icon">+</span><span>Nueva habitación</span>
  </button>

  <section>
    <h2>
      Habitaciones
      <span class="count">{studio.rooms.length}</span>
    </h2>
    {#each studio.floors as floor (floor.id)}
      {@const floorRooms = studio.rooms.filter((r) => r.floorId === floor.id)}
      {@const collapsed = collapsedFloors.has(floor.id)}
      <div
        class="floor-group"
        class:floor-drop-target={dragOverFloorId === floor.id && dragRoomId !== null}
        class:collapsed
      >
        <div class="floor-header">
          <button
            class="floor-toggle"
            onclick={() => toggleFloor(floor.id)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir piso' : 'Contraer piso'}
            title={collapsed ? 'Expandir' : 'Contraer'}
          >
            <span class="chevron" class:rotated={!collapsed}>▶</span>
          </button>
          <button
            class="floor-name"
            class:active={floor.id === studio.activeFloorId}
            onclick={() => studio.setActiveFloor(floor.id)}
            ondblclick={() => studio.setEditingFloorId(floor.id)}
            title="Activar piso"
          >
            {floor.name} <span class="floor-count">{floorRooms.length}</span>
          </button>
          <button
            class="edit floor-edit"
            onclick={() => studio.setEditingFloorId(floor.id)}
            title="Renombrar piso"
            aria-label="Renombrar piso">✎</button
          >
          <button
            class="del floor-del"
            onclick={() => confirmRemoveFloor(floor.id)}
            disabled={studio.floors.length <= 1}
            title={studio.floors.length <= 1 ? 'No puedes eliminar el único piso' : 'Eliminar piso'}
            aria-label="Eliminar piso">✕</button
          >
        </div>
        {#if !collapsed}
        <ul
          class="list floor-list"
          ondragover={(e) => onFloorDragOver(e, floor.id)}
          ondrop={(e) => onFloorDrop(e, floor.id)}
        >
          {#each floorRooms as room (room.id)}
            <li
              class:selected={room.id === studio.activeRoomId}
              class:drag-over={dragOverRoomId === room.id && dragRoomId !== room.id}
              class:dragging={dragRoomId === room.id}
              draggable="true"
              ondragstart={(e) => onRoomDragStart(e, room.id)}
              ondragover={(e) => onRoomDragOverItem(e, room.id)}
              ondrop={(e) => onRoomDropItem(e, room.id, floor.id)}
              ondragend={onRoomDragEnd}
            >
              <span class="drag-handle" aria-hidden="true">⋮⋮</span>
              <button
                class="row"
                onclick={() => studio.setActiveRoom(room.id)}
                ondblclick={() => studio.setEditingRoomId(room.id)}
              >
                <span class="room-name">{room.name}</span>
              </button>
              <button
                class="edit name-edit"
                onclick={() => studio.setEditingRoomId(room.id)}
                title="Renombrar"
                aria-label="Renombrar habitación">✎</button
              >
              <span class="row-spacer"></span>
              <button
                class="edit area-edit"
                onclick={() => onEditArea(room.id)}
                disabled={studio.drawingRoomId !== null ||
                  studio.editingContourRoomId !== null ||
                  room.points.length < 2}
                title="Editar área"
                aria-label="Editar área"
              >
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <polygon
                    points="3,3 10,2 12.5,7 9,12 3.5,11 1.5,7"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="edit walls-edit"
                onclick={() => onWalls(room.id)}
                disabled={studio.drawingRoomId !== null ||
                  studio.editingContourRoomId !== null ||
                  studio.furnishingRoomId !== null ||
                  !room.closed}
                title="Levantar paredes"
                aria-label="Levantar paredes"
              >
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <rect x="1.5" y="2" width="11" height="10" fill="none" stroke="currentColor" stroke-width="1.4" />
                  <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="currentColor" stroke-width="1.2" />
                  <line x1="1.5" y1="8.5" x2="12.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
                  <line x1="6" y1="2" x2="6" y2="5.5" stroke="currentColor" stroke-width="1.2" />
                  <line x1="3.5" y1="5.5" x2="3.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
                  <line x1="8.5" y1="5.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
                  <line x1="6" y1="8.5" x2="6" y2="12" stroke="currentColor" stroke-width="1.2" />
                  <line x1="10.5" y1="8.5" x2="10.5" y2="12" stroke="currentColor" stroke-width="1.2" />
                </svg>
              </button>
              <button
                class="edit furnish-edit"
                onclick={() => onFurnish(room.id)}
                disabled={studio.drawingRoomId !== null ||
                  studio.editingContourRoomId !== null ||
                  !room.closed}
                title="Amueblar"
                aria-label="Amueblar habitación"
              >
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <rect
                    x="1.5"
                    y="1.5"
                    width="11"
                    height="11"
                    rx="1.2"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                  />
                  <rect x="3" y="3" width="3" height="3" fill="currentColor" />
                  <rect x="8" y="3" width="3" height="2" fill="currentColor" />
                  <rect x="3" y="8" width="4" height="3" fill="currentColor" />
                </svg>
              </button>
              <button class="del" onclick={() => confirmRemoveRoom(room.id)} title="Eliminar"
                >✕</button
              >
            </li>
          {/each}
          {#if floorRooms.length === 0}
            <li class="floor-empty">Vacío · Arrastra una habitación o crea una nueva.</li>
          {/if}
        </ul>
        {/if}
      </div>
    {/each}
    <button class="new-floor-btn" onclick={() => studio.createFloor()} title="Agregar piso">
      <span class="icon">+</span><span>Nuevo piso</span>
    </button>
  </section>

  {#if studio.furnishingRoomId}
    {@const roomShapes = studio.shapes.filter((s) => s.roomId === studio.furnishingRoomId)}
    {@const mode = studio.transformMode}
    <section class="mode-section">
      <h2>Acción actual</h2>
      <div class="mode-options">
        <button
          type="button"
          class="mode-chip"
          class:active={mode === 'move'}
          onclick={() => studio.setTransformMode('move')}
        >Mover (M)</button>
        <button
          type="button"
          class="mode-chip"
          class:active={mode === 'scale'}
          onclick={() => studio.setTransformMode('scale')}
        >Escalar (E)</button>
      </div>
      <p class="mode-current">
        Estás en modo
        <strong>{#if mode === 'move'}Mover{:else}Escalar{/if}</strong>
      </p>
    </section>

    <section>
      <h2>Muebles</h2>
      <div class="grid">
        {#each furnitureKinds as k (k.kind)}
          <button
            onclick={() => studio.add(k.kind)}
            draggable="true"
            ondragstart={(e) => {
              if (e.dataTransfer) {
                e.dataTransfer.setData('application/x-shape-kind', k.kind);
                e.dataTransfer.effectAllowed = 'copy';
              }
            }}
            title={`${k.label} · clic o arrastra al área`}
          >
            <span class="icon">{k.icon}</span>
            <span>{k.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h2>Primitivas</h2>
      <div class="grid">
        {#each primitiveKinds as k (k.kind)}
          <button
            onclick={() => studio.add(k.kind)}
            draggable="true"
            ondragstart={(e) => {
              if (e.dataTransfer) {
                e.dataTransfer.setData('application/x-shape-kind', k.kind);
                e.dataTransfer.effectAllowed = 'copy';
              }
            }}
            title={`${k.label} · clic o arrastra al área`}
          >
            <span class="icon">{k.icon}</span>
            <span>{k.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h2>Objetos <span class="count">{roomShapes.length}</span></h2>
      {#if roomShapes.length === 0}
        <p class="hint">Agrega un objeto para empezar.</p>
      {:else}
        <ul class="list">
          {#each roomShapes as shape (shape.id)}
            <li class:selected={shape.id === studio.selectedId}>
              <button class="row" onclick={() => studio.select(shape.id)}>
                <span class="dot" style="background:{shape.color}"></span>
                <span>{shape.kind}</span>
              </button>
              <button class="del" onclick={() => confirmRemove(shape)} title="Eliminar">✕</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if studio.furnishingRoomId && studio.selected}
    {@const s = studio.selected}
    <section class="props">
      <h2>Propiedades</h2>

      <label class="field">
        <span>Color</span>
        <input type="color" bind:value={s.color} />
      </label>
    </section>
  {/if}
</aside>

{#if studio.editingRoomId !== null}
  {@const editingRoom = studio.rooms.find((r) => r.id === studio.editingRoomId)}
  {#if editingRoom}
    <div class="rename-backdrop" role="presentation">
      <div class="rename-modal" role="dialog" aria-modal="true">
        <h3>Nombra tu habitación</h3>
        <input
          use:autofocus
          class="rename-input"
          type="text"
          value={editingRoom.name}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              const v = (e.currentTarget as HTMLInputElement).value.trim();
              if (v) saveRoomName(editingRoom.id, v);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onblur={(e) => {
            if (studio.editingRoomId !== null) (e.currentTarget as HTMLInputElement).focus();
          }}
        />
        <p class="rename-hint">Nombra a la habitación · Enter para guardar</p>
      </div>
    </div>
  {/if}
{/if}

{#if studio.editingFloorId !== null}
  {@const editingFloor = studio.floors.find((f) => f.id === studio.editingFloorId)}
  {#if editingFloor}
    <div class="rename-backdrop" role="presentation">
      <div class="rename-modal" role="dialog" aria-modal="true">
        <h3>Renombrar piso</h3>
        <input
          use:autofocus
          class="rename-input"
          type="text"
          value={editingFloor.name}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              const v = (e.currentTarget as HTMLInputElement).value.trim();
              if (v) saveFloorName(editingFloor.id, v);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              studio.setEditingFloorId(null);
            }
          }}
        />
        <p class="rename-hint">Enter para guardar · Esc para cancelar</p>
      </div>
    </div>
  {/if}
{/if}

{#if studio.editingProject || !studio.projectName}
  {@const isFirstTime = !studio.projectName}
  <div class="rename-backdrop" role="presentation">
    <div class="rename-modal" role="dialog" aria-modal="true">
      <h3>{isFirstTime ? 'Nombra tu proyecto' : 'Renombrar proyecto'}</h3>
      <input
        use:autofocus
        class="rename-input"
        type="text"
        value={studio.projectName}
        placeholder="Ej. Mi Casa"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const v = (e.currentTarget as HTMLInputElement).value.trim();
            if (v) {
              studio.setProjectName(v);
              studio.setEditingProject(false);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (!isFirstTime) studio.setEditingProject(false);
          }
        }}
        onblur={(e) => {
          if (studio.editingProject || isFirstTime) (e.currentTarget as HTMLInputElement).focus();
        }}
      />
      <p class="rename-hint">
        {#if isFirstTime}
          Nombra tu proyecto · Enter para empezar
        {:else}
          Enter para guardar · Esc para cancelar
        {/if}
      </p>
    </div>
  </div>
{/if}

<style>
  .panel {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(26, 19, 0, 0.2);
    border-radius: 16px;
    padding: 1rem;
    backdrop-filter: blur(8px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .count {
    background: #1a1300;
    color: #ffdd00;
    border-radius: 999px;
    padding: 0.05rem 0.5rem;
    font-size: 0.7rem;
  }

  .hint {
    font-size: 0.85rem;
    opacity: 0.65;
    margin: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }

  .grid button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.55rem 0.3rem;
    background: #1a1300;
    color: #ffdd00;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.72rem;
    transition: transform 0.1s;
  }
  .grid button:hover {
    transform: translateY(-2px);
  }
  .icon {
    font-size: 1.1rem;
  }

  .list {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 180px;
    overflow-y: auto;
  }
  .floor-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.4rem 0.4rem 0.5rem;
    border: 1px solid rgba(26, 19, 0, 0.18);
    border-radius: 10px;
    margin-bottom: 0.5rem;
    background: rgba(26, 19, 0, 0.03);
    transition: background 0.12s, border-color 0.12s;
  }
  .floor-group.floor-drop-target {
    background: rgba(26, 19, 0, 0.12);
    border-color: #1a1300;
  }
  .floor-header {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0 0.1rem 0.15rem;
  }
  .floor-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.25rem;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    opacity: 0.7;
  }
  .floor-toggle:hover {
    background: rgba(26, 19, 0, 0.08);
    opacity: 1;
  }
  .chevron {
    display: inline-block;
    font-size: 0.62rem;
    line-height: 1;
    transition: transform 0.15s ease-out;
  }
  .chevron.rotated {
    transform: rotate(90deg);
  }
  .floor-group.collapsed {
    padding-bottom: 0.4rem;
  }
  .floor-name {
    flex: 1;
    background: transparent;
    border: none;
    font: inherit;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #1a1300;
    cursor: pointer;
    text-align: left;
    padding: 0.2rem 0.3rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .floor-name:hover {
    background: rgba(26, 19, 0, 0.08);
  }
  .floor-name.active {
    background: #1a1300;
    color: #ffdd00;
  }
  .floor-count {
    background: rgba(26, 19, 0, 0.12);
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 800;
  }
  .floor-name.active .floor-count {
    background: rgba(255, 255, 255, 0.18);
    color: #ffdd00;
  }
  .floor-edit,
  .floor-del {
    padding: 0.2rem 0.4rem;
    font-size: 0.85rem;
  }
  .floor-list {
    margin: 0;
    max-height: none;
  }
  .floor-empty {
    background: transparent !important;
    border: 1px dashed rgba(26, 19, 0, 0.25);
    color: rgba(26, 19, 0, 0.55);
    font-size: 0.74rem;
    padding: 0.4rem 0.5rem !important;
    justify-content: center;
    text-align: center;
  }
  .new-floor-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.4rem;
    background: transparent;
    color: #1a1300;
    border: 1.5px dashed rgba(26, 19, 0, 0.45);
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.74rem;
    transition: background 0.12s, border-color 0.12s;
  }
  .new-floor-btn:hover {
    background: rgba(26, 19, 0, 0.06);
    border-color: #1a1300;
  }
  .new-floor-btn .icon {
    font-size: 0.95rem;
    font-weight: 900;
  }
  .list li {
    display: flex;
    align-items: center;
    border-radius: 8px;
    background: rgba(26, 19, 0, 0.06);
    transition: transform 0.1s, box-shadow 0.1s, background 0.1s;
  }
  .list li.selected {
    background: #1a1300;
    color: #ffdd00;
  }
  .list li.dragging {
    opacity: 0.4;
  }
  .list li.drag-over {
    box-shadow: inset 0 2px 0 0 #1a1300;
    transform: translateY(1px);
  }
  .drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.3rem 0.4rem 0.5rem;
    color: inherit;
    opacity: 0.4;
    cursor: grab;
    user-select: none;
    font-weight: 800;
    font-size: 0.85rem;
    letter-spacing: -0.05em;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .list li:hover .drag-handle {
    opacity: 0.8;
  }
  .row {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem 0.4rem 0.7rem;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    text-align: left;
    text-transform: capitalize;
    font: inherit;
  }
  .row-spacer {
    flex: 1;
  }
  .name-edit {
    padding-left: 0.2rem;
    padding-right: 0.2rem;
  }
  .area-edit,
  .walls-edit,
  .furnish-edit {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .area-edit svg,
  .walls-edit svg,
  .furnish-edit svg {
    display: block;
  }
  .room-name {
    flex: 1;
    text-transform: none;
    font-weight: 700;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.3);
  }
  .del,
  .edit {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    padding: 0.4rem 0.5rem;
    font-size: 0.95rem;
  }
  .del:hover,
  .edit:hover {
    opacity: 1;
  }
  .field {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .field input[type='color'] {
    width: 48px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .mode-section {
    background: rgba(26, 19, 0, 0.06);
    border: 1px solid rgba(26, 19, 0, 0.18);
    border-radius: 12px;
    padding: 0.8rem 0.85rem;
  }
  .mode-section h2 {
    margin-bottom: 0.55rem;
  }
  .mode-options {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-bottom: 0.55rem;
  }
  .mode-chip {
    padding: 0.35rem 0.7rem;
    border: 2px solid rgba(26, 19, 0, 0.35);
    border-radius: 999px;
    font: inherit;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: rgba(26, 19, 0, 0.6);
    background: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.1s;
  }
  .mode-chip:hover:not(.active) {
    background: rgba(255, 255, 255, 0.85);
    color: #1a1300;
    border-color: #1a1300;
  }
  .mode-chip.active {
    background: #1a1300;
    color: #ffdd00;
    border-color: #1a1300;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    cursor: default;
  }
  .mode-current {
    margin: 0;
    font-size: 0.82rem;
    text-align: center;
  }
  .mode-current strong {
    background: #1a1300;
    color: #ffdd00;
    padding: 0.1rem 0.5rem;
    border-radius: 6px;
  }

  .project-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-bottom: 0.2rem;
  }
  .project-name {
    margin: 0;
    color: #fff;
    font-size: 1.2rem;
    font-weight: 900;
    letter-spacing: -0.01em;
    text-transform: none;
  }
  .project-edit {
    color: #fff;
    opacity: 0.7;
  }
  .project-edit:hover {
    opacity: 1;
  }

  .new-room-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: #1a1300;
    color: #ffdd00;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 800;
    font-size: 0.78rem;
    letter-spacing: 0.02em;
    transition: transform 0.1s, box-shadow 0.12s;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  .new-room-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  }
  .new-room-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .new-room-btn .icon {
    font-size: 1rem;
    font-weight: 900;
  }

  .rename-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    /* Offset to roughly match the work-area: skip header on top, inspector on right */
    padding: 5rem calc(340px + 2.25rem) 1.25rem 1.25rem;
    z-index: 50;
    animation: fadeIn 0.12s ease-out;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .rename-modal {
    background: #fff;
    padding: 1.5rem 1.75rem;
    border-radius: 16px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
    min-width: 380px;
    max-width: 90vw;
  }
  .rename-modal h3 {
    margin: 0 0 0.9rem;
    font-size: 0.95rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #1a1300;
  }
  .rename-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #1a1300;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    font-size: 1.15rem;
    color: #1a1300;
    outline: none;
    background: #fff;
    box-sizing: border-box;
  }
  .rename-input:focus {
    border-color: #f7a600;
  }
  .rename-hint {
    margin: 0.7rem 0 0;
    font-size: 0.7rem;
    text-align: center;
    opacity: 0.6;
    letter-spacing: 0.04em;
  }
</style>
