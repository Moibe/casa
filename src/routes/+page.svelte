<script lang="ts">
  import Scene from '$lib/Scene.svelte';
  import Inspector from '$lib/Inspector.svelte';
  import { studio } from '$lib/studio.svelte';
  import { confirmStore } from '$lib/confirm.svelte';

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-blueprint', studio.theme === 'blueprint');
  });

  let fileInput: HTMLInputElement;

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

<div class="top-right">
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
</div>

<main>
  <header>
    <h1>Casa 🏠</h1>
  </header>

  <section class="stage">
    <Scene />
    {#if studio.activeRoom}
      <div class="active-room-label">
        <span class="active-room-name">{studio.activeRoom.name}</span>
        {#if studio.mandatoryContour}
          <span class="contour-prompt">
            <span class="step-num">1.</span> Dibuja el área de tu habitación
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

  <Inspector />
</main>

<style>
  main {
    display: grid;
    grid-template-columns: 1fr 340px;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    padding: 1.25rem;
    height: 100vh;
  }

  header {
    grid-column: 1 / -1;
    display: flex;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 900;
    letter-spacing: -0.02em;
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
  .contour-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    z-index: 20;
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
</style>
