<script lang="ts">
  import { contextMenu } from './ctxmenu.svelte';

  function onKey(ev: KeyboardEvent) {
    if (contextMenu.visible && ev.key === 'Escape') {
      ev.preventDefault();
      contextMenu.close();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if contextMenu.visible}
  <button
    class="ctx-overlay"
    aria-label="Cerrar menú"
    onclick={() => contextMenu.close()}
    oncontextmenu={(e) => {
      e.preventDefault();
      contextMenu.close();
    }}
  ></button>
  <div class="ctx-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;" role="menu">
    {#each contextMenu.items as item, i (i)}
      <button
        type="button"
        class="ctx-item"
        class:danger={item.danger}
        onclick={() => {
          item.onClick();
          contextMenu.close();
        }}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .ctx-overlay {
    position: fixed;
    inset: 0;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
    z-index: 90;
  }
  .ctx-menu {
    position: fixed;
    z-index: 91;
    min-width: 160px;
    background: #fff;
    border: 2px solid #1a1300;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ctx-item {
    background: transparent;
    border: none;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-weight: 700;
    font-size: 0.82rem;
    text-align: left;
    color: #1a1300;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .ctx-item:hover {
    background: #1a1300;
    color: #ffdd00;
  }
  .ctx-item.danger {
    color: #b91c1c;
  }
  .ctx-item.danger:hover {
    background: #b91c1c;
    color: #fff;
  }

  :global(.theme-blueprint) .ctx-menu {
    background: #0c1e4a;
    border-color: #fff;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
  }
  :global(.theme-blueprint) .ctx-item {
    color: #fff;
  }
  :global(.theme-blueprint) .ctx-item:hover {
    background: #fff;
    color: #0c1e4a;
  }
  :global(.theme-blueprint) .ctx-item.danger {
    color: #ff8a8a;
  }
</style>
