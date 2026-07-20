<script lang="ts">
  import { onMount } from 'svelte';
  import Scene from '$lib/Scene.svelte';
  import Inspector from '$lib/Inspector.svelte';
  import ContextMenu from '$lib/ContextMenu.svelte';
  import { studio } from '$lib/studio.svelte';
  import { confirmStore } from '$lib/confirm.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let hydrated = $state(false);

  let sidebarCollapsed = $state(
    typeof localStorage !== 'undefined' && localStorage.getItem('casa:sidebarCollapsed') === '1'
  );
  $effect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('casa:sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  });

  onMount(() => {
    // Hidratar del servidor + migrar localStorage (una vez) + crear proyecto si no hay ninguno.
    void studio.init(data.user.id, data.projects).then(() => {
      hydrated = true;
    });
    const flush = () => {
      void studio.flush();
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-blueprint', studio.theme === 'blueprint');
  });

  let fileInput: HTMLInputElement;

  let projectMenuOpen = $state(false);

  function onWindowClick(e: MouseEvent) {
    if (!projectMenuOpen) return;
    const root = document.querySelector('.projects');
    if (root && !root.contains(e.target as Node)) projectMenuOpen = false;
  }

  async function confirmDeleteProject(id: string, name: string) {
    projectMenuOpen = false;
    const ok = await confirmStore.ask({
      title: 'Eliminar proyecto',
      message: `Se eliminará el proyecto "${name || 'Sin nombre'}" con todas sus habitaciones y objetos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (ok) studio.deleteProject(id);
  }

  function renameProject(id: string) {
    studio.switchProject(id);
    projectMenuOpen = false;
    studio.setEditingProject(true);
  }

  function exportScene() {
    const json = studio.serialize();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `escena-3d-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function navigateRoom(dir: 1 | -1) {
    const rooms = studio.rooms;
    if (rooms.length < 2) return;
    const currentIdx = rooms.findIndex((r) => r.id === studio.activeRoomId);
    const fromIdx = currentIdx === -1 ? 0 : currentIdx;
    const newIdx = (fromIdx + dir + rooms.length) % rooms.length;
    studio.setActiveRoom(rooms[newIdx].id);
  }

  async function onFileChosen(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const text = await file.text();

    if (studio.shapes.length > 0) {
      const ok = await confirmStore.ask({
        title: 'Importar escena',
        message: `Se reemplazarán las ${studio.shapes.length} figuras actuales por las del archivo. ¿Continuar?`,
        confirmText: 'Importar',
        danger: true
      });
      if (!ok) return;
    }

    const result = studio.load(text);
    if (!result.ok) {
      await confirmStore.ask({
        title: 'Error al importar',
        message: result.error,
        confirmText: 'Entendido',
        cancelText: 'Cerrar',
        danger: false
      });
    }
  }
</script>

<svelte:window onclick={onWindowClick} />

{#if hydrated}
<header class="topbar">
  <h1 class="brand">Casa 🏠</h1>
  <div class="top-right">
  {#if studio.saveStatus === 'saving'}
    <span class="save-status">Guardando…</span>
  {:else if studio.saveStatus === 'saved'}
    <span class="save-status ok">Guardado ✓</span>
  {:else if studio.saveStatus === 'error'}
    <span class="save-status err">Error al guardar</span>
  {/if}
  <div class="projects">
    <button
      class="projects-btn"
      onclick={() => (projectMenuOpen = !projectMenuOpen)}
      title="Proyectos"
    >
      <span class="proj-icon">🗂</span>
      <span class="proj-name">{studio.projectName || 'Sin nombre'}</span>
      <span class="proj-caret" class:open={projectMenuOpen}>▾</span>
    </button>

    {#if projectMenuOpen}
      <div class="project-menu">
        <p class="project-menu-title">
          Proyectos <span class="pcount">{studio.projects.length}</span>
        </p>
        <ul class="project-menu-list">
          {#each studio.projects as p (p.id)}
            <li class:active={p.id === studio.currentProjectId}>
              <button
                class="project-menu-item"
                onclick={() => {
                  studio.switchProject(p.id);
                  projectMenuOpen = false;
                }}
              >
                <span class="project-dot" class:on={p.id === studio.currentProjectId}></span>
                <span class="project-menu-name">{p.name || 'Sin nombre'}</span>
              </button>
              <button
                class="project-menu-rename"
                onclick={() => renameProject(p.id)}
                title="Renombrar proyecto"
                aria-label="Renombrar proyecto">✎</button
              >
              <button
                class="project-menu-del"
                disabled={studio.projects.length <= 1}
                onclick={() => confirmDeleteProject(p.id, p.name)}
                title={studio.projects.length <= 1
                  ? 'No puedes eliminar el único proyecto'
                  : 'Eliminar proyecto'}
                aria-label="Eliminar proyecto">✕</button
              >
            </li>
          {/each}
        </ul>
        <button
          class="project-menu-new"
          onclick={() => {
            studio.createProject();
            projectMenuOpen = false;
          }}
        >
          <span class="icon">＋</span><span>Nuevo proyecto</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="archive">
    <button
      class="archive-btn"
      onclick={exportScene}
      disabled={studio.shapes.length === 0 && studio.rooms.filter((r) => r.closed).length === 0}
      title="Exportar escena a JSON"
    >
      <span>⬇</span><span>Exportar</span>
    </button>
    <button class="archive-btn" onclick={() => fileInput.click()} title="Importar escena desde JSON">
      <span>⬆</span><span>Importar</span>
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={onFileChosen}
      hidden
    />
  </div>

  <div class="view-toggle">
    <button
      class:active={studio.viewMode === 'perspective'}
      onclick={() => studio.setView('perspective')}
      title="Vista 3D libre"
    >
      <span class="icon">⌂</span><span>Perspectiva</span>
    </button>
    <button
      class:active={studio.viewMode === 'top'}
      onclick={() => studio.setView('top')}
      title="Vista cenital (planta)"
    >
      <span class="icon">▦</span><span>Cenital</span>
    </button>
  </div>

  <button
    class="theme-switch"
    class:on={studio.theme === 'blueprint'}
    onclick={() => studio.setTheme(studio.theme === 'blueprint' ? 'default' : 'blueprint')}
    aria-label="Cambiar tema"
    title={studio.theme === 'blueprint' ? 'Cambiar a Casa' : 'Cambiar a Blueprint'}
  >
    <span class="thumb">{studio.theme === 'blueprint' ? '📐' : '🟡'}</span>
  </button>

  <form method="POST" action="?/logout" class="user-menu">
    <span class="user-email" title={data.user.email}>{data.user.email}</span>
    <button type="submit" class="logout-btn" title="Cerrar sesión">Salir</button>
  </form>
  </div>
</header>

<Inspector
  collapsed={sidebarCollapsed}
  toggleCollapsed={() => (sidebarCollapsed = !sidebarCollapsed)}
/>

<main class:collapsed={sidebarCollapsed}>
  <section class="stage">
    <Scene />
    {#if studio.activeRoom}
      <div class="active-room-label">
        <span class="active-room-name">{studio.activeRoom.name}</span>
        {#if studio.mandatoryContour}
          <span class="contour-prompt">
            <span class="step-num">1.</span> Dibuja el área de tu habitación
          </span>
        {:else if studio.mandatoryWalls}
          <span class="contour-prompt">
            <span class="step-num">2.</span> Define la altura de las paredes
          </span>
        {/if}
      </div>
    {/if}
    {#if studio.rooms.length === 0}
      <div class="empty-state">
        <span>Crea tu primera habitación con el botón</span>
        <button class="btn-preview" onclick={() => studio.createAndEditRoom()}>
          <span class="icon">+</span><span>Nueva habitación</span>
        </button>
      </div>
    {/if}
    {#if studio.editingContourRoom}
      {@const editing = studio.editingContourRoom}
      <div class="contour-controls">
        <p class="contour-hint">
          {#if !editing.closed}
            Tienes una arista suelta — arrastra una punta sobre la otra para cerrar el contorno.
          {:else}
            Editando contorno de <strong>{editing.name}</strong>. Arrastra un punto para
            moverlo · clic en una arista para insertar punto · Alt+arrastrar para safar la
            arista.
          {/if}
        </p>
        <div class="contour-actions">
          <button
            class="contour-btn"
            onclick={() => studio.finishEditingContour()}
            disabled={!editing.closed}
          >
            <span>✓</span><span>Listo</span>
          </button>
          <button class="contour-btn" onclick={() => studio.cancelEditingContour()}>
            <span>✕</span><span>Cancelar</span>
          </button>
        </div>
      </div>
    {/if}
    {#if studio.wallsRoom && !studio.drawingRoom && !studio.editingContourRoom}
      {@const wallsR = studio.wallsRoom}
      {@const sel = studio.selectedWallEdge}
      {@const heights = wallsR.wallHeights ?? []}
      {@const currentHeight = sel === null ? heights[0] ?? 2.4 : heights[sel] ?? 2.4}
      {@const openingsHere =
        sel === null ? [] : (wallsR.openings ?? []).filter((o) => o.edgeIdx === sel)}
      <div class="contour-controls">
        <p class="contour-hint">
          {#if studio.mandatoryWalls}
            <strong>Paso 2.</strong> Define la altura de las paredes de {wallsR.name}.
          {:else}
            Modo <strong>Paredes</strong> en {wallsR.name} ·
          {/if}
          {#if sel === null}
            Todas las paredes seleccionadas
          {:else}
            Pared {sel + 1} de {heights.length} seleccionada
          {/if}
        </p>
        <div class="wall-height">
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.05"
            value={currentHeight}
            oninput={(e) =>
              studio.setWallHeight(wallsR.id, sel, Number((e.currentTarget as HTMLInputElement).value))}
          />
          <span class="wall-height-value">{currentHeight.toFixed(2)} m</span>
        </div>
        {#if sel !== null}
          <div class="openings-row">
            <button class="contour-btn" onclick={() => studio.addOpening(wallsR.id, sel, 'door')}>
              <span>🚪</span><span>+ Puerta</span>
            </button>
            <button
              class="contour-btn"
              onclick={() => studio.addOpening(wallsR.id, sel, 'window')}
            >
              <span>▭</span><span>+ Ventana</span>
            </button>
          </div>
          {#if openingsHere.length > 0}
            <ul class="openings-list">
              {#each openingsHere as op (op.id)}
                <li class:selected={studio.selectedOpeningId === op.id}>
                  <button
                    class="op-row"
                    onclick={() =>
                      studio.selectOpening(studio.selectedOpeningId === op.id ? null : op.id)}
                  >
                    <span class="op-icon">{op.kind === 'door' ? '🚪' : '▭'}</span>
                    <span class="op-label">
                      {op.kind === 'door' ? 'Puerta' : 'Ventana'}
                      · {op.width.toFixed(2)} × {op.height.toFixed(2)} m
                    </span>
                  </button>
                  <button
                    class="op-del"
                    onclick={() => studio.removeOpening(wallsR.id, op.id)}
                    title="Eliminar"
                    aria-label="Eliminar abertura">✕</button
                  >
                </li>
              {/each}
            </ul>
          {/if}
          {#if studio.selectedOpening}
            {@const op = studio.selectedOpening}
            {@const a = wallsR.points[op.edgeIdx]}
            {@const b = wallsR.points[(op.edgeIdx + 1) % wallsR.points.length]}
            {@const L = Math.hypot(b.x - a.x, b.z - a.z)}
            {@const wH = wallsR.wallHeights?.[op.edgeIdx] ?? 2.4}
            <div class="op-edit">
              <label class="op-field">
                <span class="op-field-label">Posición</span>
                <input
                  type="range"
                  min="0.05"
                  max={Math.max(0.05, L - 0.05 - op.width)}
                  step="0.01"
                  value={op.position}
                  oninput={(e) =>
                    studio.updateOpening(wallsR.id, op.id, {
                      position: Number((e.currentTarget as HTMLInputElement).value)
                    })}
                />
                <span class="op-value">{op.position.toFixed(2)} m</span>
              </label>
              <label class="op-field">
                <span class="op-field-label">Base</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, wH - 0.05 - op.height)}
                  step="0.01"
                  value={op.bottom}
                  oninput={(e) =>
                    studio.updateOpening(wallsR.id, op.id, {
                      bottom: Number((e.currentTarget as HTMLInputElement).value)
                    })}
                />
                <span class="op-value">{op.bottom.toFixed(2)} m</span>
              </label>
              <label class="op-field">
                <span class="op-field-label">Ancho</span>
                <input
                  type="range"
                  min="0.2"
                  max={Math.max(0.2, L - 0.1)}
                  step="0.01"
                  value={op.width}
                  oninput={(e) =>
                    studio.updateOpening(wallsR.id, op.id, {
                      width: Number((e.currentTarget as HTMLInputElement).value)
                    })}
                />
                <span class="op-value">{op.width.toFixed(2)} m</span>
              </label>
              <label class="op-field">
                <span class="op-field-label">Alto</span>
                <input
                  type="range"
                  min="0.2"
                  max={Math.max(0.2, wH - 0.05 - op.bottom)}
                  step="0.01"
                  value={op.height}
                  oninput={(e) =>
                    studio.updateOpening(wallsR.id, op.id, {
                      height: Number((e.currentTarget as HTMLInputElement).value)
                    })}
                />
                <span class="op-value">{op.height.toFixed(2)} m</span>
              </label>
            </div>
          {/if}
        {/if}
        <div class="contour-actions">
          {#if sel !== null}
            <button class="contour-btn" onclick={() => studio.selectWallEdge(null)}>
              <span>⬚</span><span>Todas</span>
            </button>
          {/if}
          <button class="contour-btn" onclick={() => studio.stopWalls()}>
            <span>✓</span><span>Listo</span>
          </button>
        </div>
      </div>
    {/if}
    {#if studio.furnishingRoom && !studio.drawingRoom && !studio.editingContourRoom}
      {@const furnishing = studio.furnishingRoom}
      <div class="contour-controls">
        <p class="contour-hint">
          Amueblando <strong>{furnishing.name}</strong>. Agrega objetos desde el panel lateral.
        </p>
        <div class="contour-actions">
          <button
            class="contour-btn"
            class:active={studio.furnishingWallsHidden}
            onclick={() => studio.toggleFurnishingWallsHidden()}
            title={studio.furnishingWallsHidden ? 'Mostrar paredes' : 'Ocultar paredes'}
          >
            <span>{studio.furnishingWallsHidden ? '◱' : '⬚'}</span><span
              >{studio.furnishingWallsHidden ? 'Mostrar paredes' : 'Ocultar paredes'}</span
            >
          </button>
          <button class="contour-btn" onclick={() => studio.stopFurnishing()}>
            <span>✓</span><span>Listo</span>
          </button>
        </div>
      </div>
    {/if}
    {#if studio.drawingRoom}
      {@const drawing = studio.drawingRoom}
      <div class="contour-controls">
        <p class="contour-hint">
          {#if studio.mandatoryContour}
            Traza el contorno de <strong>{drawing.name}</strong>.
          {:else}
            Dibujando contorno ·
          {/if}
          {drawing.points.length}
          {drawing.points.length === 1 ? 'punto' : 'puntos'}.
          {#if drawing.points.length < 3}
            Marca al menos 3 puntos para cerrar.
          {:else}
            Clic en el primer punto o presiona Enter para cerrar.
          {/if}
        </p>
        <div class="contour-actions">
          <button
            class="contour-btn"
            onclick={() => studio.closeDrawingRoom()}
            disabled={drawing.points.length < 3}
          >
            <span>✓</span><span>Cerrar</span>
          </button>
          <button class="contour-btn" onclick={() => studio.cancelDrawingRoom()}>
            {#if studio.mandatoryContour}
              <span>✕</span><span>Cancelar y eliminar</span>
            {:else}
              <span>✕</span><span>Cancelar</span>
            {/if}
          </button>
        </div>
      </div>
    {/if}
    <span class="scale">📐 1 cuadrícula = 1 m</span>
    {#if studio.rooms.length > 1 && !studio.drawingRoomId && !studio.editingContourRoomId}
      <button
        class="nav-arrow nav-left"
        onclick={() => navigateRoom(-1)}
        aria-label="Habitación anterior"
        title="Habitación anterior">‹</button
      >
      <button
        class="nav-arrow nav-right"
        onclick={() => navigateRoom(1)}
        aria-label="Siguiente habitación"
        title="Siguiente habitación">›</button
      >
    {/if}
  </section>
</main>

<ContextMenu />
{:else}
  <div class="app-loading">Cargando…</div>
{/if}

<style>
  /* Barra superior full-width: marca (izq) + chips (der), a todo lo ancho de la página. */
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--topbar-h);
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 1rem;
    box-sizing: border-box;
  }
  .brand {
    margin: 0;
    font-size: clamp(1.4rem, 2.4vw, 1.9rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--ink);
    white-space: nowrap;
  }

  main {
    display: grid;
    height: 100vh;
    box-sizing: border-box;
    /* Empieza debajo de la topbar; el lienzo se corre a la derecha de la barra glass. */
    padding: calc(var(--topbar-h) + 1rem) 1rem 1rem 0;
    margin-left: calc(var(--sidebar-width, 340px) + 2rem);
    transition: margin-left 0.18s ease-out;
  }
  main.collapsed {
    margin-left: 3.75rem;
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    font-size: 1.05rem;
    font-weight: 600;
    color: rgba(26, 19, 0, 0.55);
    pointer-events: none;
    z-index: 2;
    text-align: center;
    padding: 0 2rem;
  }

  .btn-preview {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.1rem;
    background: #1a1300;
    color: #ffdd00;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 800;
    font-size: 0.85rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.12s;
  }
  .btn-preview:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  }
  .btn-preview .icon {
    font-size: 1.05rem;
    font-weight: 900;
  }

  .contour-controls {
    position: absolute;
    bottom: 1.2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 1.1rem;
    background: rgba(255, 255, 255, 0.85);
    border: 2px solid #1a1300;
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(6px);
    z-index: 4;
    max-width: 90%;
  }
  .contour-hint {
    margin: 0;
    font-size: 0.85rem;
    color: #1a1300;
    text-align: center;
    line-height: 1.35;
  }
  .contour-actions {
    display: flex;
    gap: 0.5rem;
  }
  .contour-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.95rem;
    background: transparent;
    color: #1a1300;
    border: 2px solid #1a1300;
    border-radius: 10px;
    cursor: pointer;
    font: inherit;
    font-weight: 800;
    font-size: 0.78rem;
    transition: background 0.12s, color 0.12s;
  }
  .contour-btn:hover:not(:disabled) {
    background: #1a1300;
    color: #ffdd00;
  }
  .contour-btn.active {
    background: #1a1300;
    color: #ffdd00;
  }
  .contour-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .wall-height {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    min-width: 280px;
  }
  .wall-height input[type='range'] {
    flex: 1;
    height: 24px;
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }
  .wall-height input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    background: #1a1300;
    border-radius: 999px;
  }
  .wall-height input[type='range']::-moz-range-track {
    height: 6px;
    background: #1a1300;
    border-radius: 999px;
  }
  .wall-height input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffdd00;
    border: 2px solid #1a1300;
    margin-top: -6px;
    cursor: pointer;
  }
  .wall-height input[type='range']::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffdd00;
    border: 2px solid #1a1300;
    cursor: pointer;
  }
  .wall-height-value {
    font-weight: 800;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    background: #1a1300;
    color: #ffdd00;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    min-width: 4.5rem;
    text-align: center;
  }
  .openings-row {
    display: flex;
    gap: 0.4rem;
  }
  .openings-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 100%;
    max-height: 120px;
    overflow-y: auto;
  }
  .openings-list li {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.3rem;
    background: rgba(26, 19, 0, 0.06);
    border-radius: 6px;
    font-size: 0.78rem;
  }
  .openings-list li.selected {
    background: #1a1300;
  }
  .openings-list li.selected .op-label,
  .openings-list li.selected .op-del {
    color: #ffdd00;
  }
  :global(.theme-blueprint) .openings-list li {
    background: rgba(255, 255, 255, 0.1);
  }
  :global(.theme-blueprint) .openings-list li.selected {
    background: #fff;
  }
  :global(.theme-blueprint) .openings-list li.selected .op-label,
  :global(.theme-blueprint) .openings-list li.selected .op-del {
    color: #0c1e4a;
  }
  .op-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: none;
    padding: 0.15rem 0.2rem;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .op-icon {
    font-size: 0.95rem;
  }
  .op-label {
    flex: 1;
    color: #1a1300;
  }
  .op-edit {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem 0.6rem;
    background: rgba(26, 19, 0, 0.05);
    border: 1px dashed rgba(26, 19, 0, 0.25);
    border-radius: 8px;
    min-width: 280px;
  }
  :global(.theme-blueprint) .op-edit {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.3);
  }
  .op-field {
    display: grid;
    grid-template-columns: 60px 1fr 60px;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.74rem;
  }
  .op-field-label {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    opacity: 0.75;
    color: #1a1300;
  }
  :global(.theme-blueprint) .op-field-label {
    color: #fff;
  }
  .op-value {
    background: #1a1300;
    color: #ffdd00;
    padding: 0.1rem 0.4rem;
    border-radius: 5px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: center;
    font-size: 0.7rem;
  }
  :global(.theme-blueprint) .op-value {
    background: #fff;
    color: #0c1e4a;
  }
  .op-field input[type='range'] {
    width: 100%;
    height: 18px;
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }
  .op-field input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    background: #1a1300;
    border-radius: 999px;
  }
  .op-field input[type='range']::-moz-range-track {
    height: 4px;
    background: #1a1300;
    border-radius: 999px;
  }
  .op-field input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffdd00;
    border: 2px solid #1a1300;
    margin-top: -5px;
    cursor: pointer;
  }
  .op-field input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffdd00;
    border: 2px solid #1a1300;
    cursor: pointer;
  }
  :global(.theme-blueprint) .op-label {
    color: #fff;
  }
  .op-del {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.15rem 0.4rem;
    color: #1a1300;
    opacity: 0.6;
    border-radius: 4px;
  }
  :global(.theme-blueprint) .op-del {
    color: #fff;
  }
  .op-del:hover {
    opacity: 1;
    background: rgba(185, 28, 28, 0.15);
    color: #b91c1c;
  }
  :global(.theme-blueprint) .op-del:hover {
    background: rgba(255, 138, 138, 0.18);
    color: #ff8a8a;
  }

  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid #1a1300;
    color: #1a1300;
    font-size: 1.4rem;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    z-index: 4;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    opacity: 0.55;
    transition: opacity 0.12s, transform 0.12s, background 0.12s;
    padding: 0;
  }
  .nav-arrow:hover {
    opacity: 1;
    transform: translateY(-50%) scale(1.08);
  }
  .nav-left {
    left: 0.9rem;
  }
  .nav-right {
    right: 0.9rem;
  }

  .scale {
    position: absolute;
    bottom: 0.9rem;
    right: 1.1rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: rgba(26, 19, 0, 0.08);
    border: 1px solid rgba(26, 19, 0, 0.25);
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    color: #1a1300;
    pointer-events: none;
    z-index: 3;
  }

  .stage {
    background: rgba(26, 19, 0, 0.08);
    border: 2px dashed rgba(26, 19, 0, 0.35);
    border-radius: 16px;
    overflow: hidden;
    backdrop-filter: blur(2px);
    position: relative;
  }

  .active-room-label {
    position: absolute;
    top: 0.9rem;
    left: 1.1rem;
    color: #1a1300;
    pointer-events: none;
    z-index: 3;
    max-width: 65%;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .active-room-name {
    font-weight: 900;
    font-size: 1.15rem;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .contour-prompt {
    font-size: 0.78rem;
    font-weight: 500;
    opacity: 0.75;
    letter-spacing: 0.01em;
  }
  .step-num {
    font-weight: 800;
    opacity: 0.85;
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .projects {
    position: relative;
    display: flex;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid #1a1300;
    border-radius: 999px;
    padding: 2px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .projects-btn {
    height: 26px;
    max-width: 200px;
    padding: 0 0.7rem;
    background: transparent;
    border: none;
    border-radius: 999px;
    color: #1a1300;
    font-weight: 700;
    font-size: 0.72rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .projects-btn:hover {
    background: rgba(26, 19, 0, 0.08);
  }
  .proj-icon {
    font-size: 0.85rem;
  }
  .proj-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proj-caret {
    font-size: 0.6rem;
    opacity: 0.7;
    transition: transform 0.15s;
  }
  .proj-caret.open {
    transform: rotate(180deg);
  }

  .project-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    width: 240px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.6rem;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  }
  .project-menu-title {
    margin: 0 0 0.15rem;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .pcount {
    background: var(--ink);
    color: var(--safety-yellow);
    border-radius: 999px;
    padding: 0.05rem 0.45rem;
    font-size: 0.62rem;
  }
  .project-menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 260px;
    overflow-y: auto;
  }
  .project-menu-list li {
    display: flex;
    align-items: center;
    border-radius: 8px;
    background: rgba(26, 19, 0, 0.06);
  }
  .project-menu-list li.active {
    background: var(--ink);
  }
  .project-menu-item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.55rem;
    background: transparent;
    border: none;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-weight: 700;
    font-size: 0.8rem;
  }
  .project-menu-list li.active .project-menu-item {
    color: var(--safety-yellow);
  }
  .project-menu-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    flex: none;
    opacity: 0.5;
  }
  .project-dot.on {
    background: currentColor;
    opacity: 1;
  }
  .project-menu-rename,
  .project-menu-del {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    padding: 0.35rem 0.4rem;
    font-size: 0.82rem;
  }
  .project-menu-rename:hover {
    opacity: 1;
  }
  .project-menu-del:hover:not(:disabled) {
    opacity: 1;
    color: #b91c1c;
  }
  .project-menu-list li.active .project-menu-rename,
  .project-menu-list li.active .project-menu-del {
    color: var(--safety-yellow);
  }
  .project-menu-del:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
  .project-menu-new {
    margin-top: 0.15rem;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.5rem;
    background: var(--ink);
    color: var(--safety-yellow);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 800;
    font-size: 0.74rem;
  }
  .project-menu-new .icon {
    font-size: 1rem;
    font-weight: 900;
  }

  .archive {
    display: flex;
    gap: 0.3rem;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid #1a1300;
    border-radius: 999px;
    padding: 2px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .archive-btn {
    height: 26px;
    padding: 0 0.7rem;
    background: transparent;
    border: none;
    border-radius: 999px;
    color: #1a1300;
    font-weight: 700;
    font-size: 0.72rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: background 0.12s, color 0.12s, opacity 0.12s;
  }
  .archive-btn:hover:not(:disabled) {
    background: rgba(26, 19, 0, 0.08);
  }
  .archive-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .view-toggle {
    display: flex;
    gap: 0.3rem;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid #1a1300;
    border-radius: 999px;
    padding: 2px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .view-toggle button {
    height: 26px;
    padding: 0 0.7rem;
    background: transparent;
    border: none;
    border-radius: 999px;
    color: #1a1300;
    font-weight: 700;
    font-size: 0.72rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: background 0.12s, color 0.12s;
  }
  .view-toggle button:hover {
    background: rgba(26, 19, 0, 0.08);
  }
  .view-toggle button.active {
    background: #1a1300;
    color: #ffdd00;
  }
  .view-toggle .icon {
    font-size: 0.85rem;
  }

  .theme-switch {
    width: 56px;
    height: 30px;
    border-radius: 999px;
    background: #1a1300;
    border: 2px solid #1a1300;
    cursor: pointer;
    padding: 0;
    transition:
      background 0.2s,
      border-color 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .theme-switch.on {
    background: #ffffff;
    border-color: #0c1e4a;
  }
  .theme-switch .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffdd00;
    margin-left: 2px;
    font-size: 0.7rem;
    transition:
      transform 0.2s,
      background 0.2s;
  }
  .theme-switch.on .thumb {
    background: #0c1e4a;
    transform: translateX(26px);
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: 30px;
    padding: 0 0.35rem 0 0.7rem;
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid #1a1300;
    border-radius: 999px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .user-email {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.72rem;
    font-weight: 700;
    color: #1a1300;
  }
  .logout-btn {
    height: 22px;
    padding: 0 0.6rem;
    background: #1a1300;
    color: #ffdd00;
    border: none;
    border-radius: 999px;
    font: inherit;
    font-weight: 800;
    font-size: 0.68rem;
    cursor: pointer;
  }
  .logout-btn:hover {
    opacity: 0.85;
  }

  .save-status {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: rgba(26, 19, 0, 0.1);
    color: rgba(26, 19, 0, 0.7);
    align-self: center;
  }
  .save-status.ok {
    background: rgba(22, 163, 74, 0.15);
    color: #16a34a;
  }
  .save-status.err {
    background: rgba(185, 28, 28, 0.15);
    color: #b91c1c;
  }

  .app-loading {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    color: var(--ink);
    opacity: 0.7;
  }
</style>
