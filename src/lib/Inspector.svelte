<script lang="ts">
  import { studio, type PrimitiveKind, type Shape } from './studio.svelte';
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
  async function confirmClear() {
    if (studio.shapes.length === 0) return;
    const ok = await confirmStore.ask({
      title: 'Vaciar escena',
      message: `Se eliminarán ${studio.shapes.length} figura${studio.shapes.length === 1 ? '' : 's'}. ¿Continuar?`,
      confirmText: 'Vaciar',
      danger: true
    });
    if (ok) studio.clear();
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

  const kinds: { kind: PrimitiveKind; label: string; icon: string }[] = [
    { kind: 'box', label: 'Cubo', icon: '◼' },
    { kind: 'sphere', label: 'Esfera', icon: '●' },
    { kind: 'cylinder', label: 'Cilindro', icon: '▮' },
    { kind: 'cone', label: 'Cono', icon: '▲' },
    { kind: 'torus', label: 'Toro', icon: '◯' }
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
    {#if studio.rooms.length > 0}
      <ul class="list">
        {#each studio.rooms as room (room.id)}
          <li class:selected={room.id === studio.activeRoomId}>
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
            <button class="del" onclick={() => confirmRemoveRoom(room.id)} title="Eliminar"
              >✕</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section>
    <h2>Crear</h2>
    <div class="grid">
      {#each kinds as k (k.kind)}
        <button onclick={() => studio.add(k.kind)} title={k.label}>
          <span class="icon">{k.icon}</span>
          <span>{k.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Escena <span class="count">{studio.shapes.length}</span></h2>
    {#if studio.shapes.length === 0}
      <p class="hint">Agrega una figura para empezar.</p>
    {:else}
      <ul class="list">
        {#each studio.shapes as shape (shape.id)}
          <li class:selected={shape.id === studio.selectedId}>
            <button class="row" onclick={() => studio.select(shape.id)}>
              <span class="dot" style="background:{shape.color}"></span>
              <span>{shape.kind}</span>
            </button>
            <button class="del" onclick={() => confirmRemove(shape)} title="Eliminar">✕</button>
          </li>
        {/each}
      </ul>
      <button class="clear" onclick={confirmClear}>Vaciar escena</button>
    {/if}
  </section>

  {#if studio.selected}
    {@const s = studio.selected}
    <section class="props">
      <h2>Propiedades</h2>

      <label class="field">
        <span>Color</span>
        <input type="color" bind:value={s.color} />
      </label>

      <fieldset>
        <legend>Posición</legend>
        {#each ['x', 'y', 'z'] as axis}
          <label>
            <span>{axis}</span>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.05"
              bind:value={s.position[axis as 'x' | 'y' | 'z']}
            />
            <output>{s.position[axis as 'x' | 'y' | 'z'].toFixed(2)}</output>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Escala</legend>
        {#each ['x', 'y', 'z'] as axis}
          <label>
            <span>{axis}</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              bind:value={s.scale[axis as 'x' | 'y' | 'z']}
            />
            <output>{s.scale[axis as 'x' | 'y' | 'z'].toFixed(2)}</output>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Rotación</legend>
        {#each ['x', 'y', 'z'] as axis}
          <label>
            <span>{axis}</span>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step="0.01"
              bind:value={s.rotation[axis as 'x' | 'y' | 'z']}
            />
            <output>{s.rotation[axis as 'x' | 'y' | 'z'].toFixed(2)}</output>
          </label>
        {/each}
      </fieldset>
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
  .list li {
    display: flex;
    align-items: center;
    border-radius: 8px;
    background: rgba(26, 19, 0, 0.06);
  }
  .list li.selected {
    background: #1a1300;
    color: #ffdd00;
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
  .area-edit {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .area-edit svg {
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
  .clear {
    width: 100%;
    padding: 0.4rem;
    background: transparent;
    border: 1px dashed rgba(26, 19, 0, 0.4);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .props fieldset {
    border: 1px solid rgba(26, 19, 0, 0.2);
    border-radius: 10px;
    padding: 0.5rem 0.7rem;
    margin: 0 0 0.5rem;
  }
  .props legend {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0 0.3rem;
  }
  .props label {
    display: grid;
    grid-template-columns: 14px 1fr 42px;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
  }
  .props label span {
    font-weight: 700;
    text-transform: uppercase;
  }
  .props output {
    font-variant-numeric: tabular-nums;
    text-align: right;
    font-size: 0.72rem;
    opacity: 0.75;
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

  input[type='range'] {
    accent-color: #1a1300;
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
    gap: 0.5rem;
    padding: 0.75rem;
    background: #1a1300;
    color: #ffdd00;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 800;
    font-size: 0.9rem;
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
    font-size: 1.2rem;
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
