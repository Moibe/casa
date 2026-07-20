<script lang="ts">
  let { form } = $props();
</script>

<div class="auth">
  <form method="POST" class="card">
    <h1>Casa 🏠</h1>
    <p class="sub">Inicia sesión</p>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}

    <label>
      <span>Email</span>
      <input type="email" name="email" value={form?.email ?? ''} autocomplete="email" required />
    </label>
    <label>
      <span>Contraseña</span>
      <input type="password" name="password" autocomplete="current-password" required />
    </label>

    <button type="submit">Entrar</button>
    <p class="alt">¿No tienes cuenta? <a href="/register">Crear una</a></p>
  </form>
</div>

<style>
  .auth {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .card {
    width: 100%;
    max-width: 360px;
    background: rgba(255, 255, 255, 0.7);
    border: 2px solid var(--ink);
    border-radius: 18px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(6px);
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .sub {
    margin: 0 0 0.4rem;
    font-weight: 700;
    opacity: 0.7;
    color: var(--ink);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink);
  }
  input {
    padding: 0.6rem 0.75rem;
    border: 2px solid var(--ink);
    border-radius: 10px;
    font: inherit;
    font-weight: 600;
    background: #fff;
    color: var(--ink);
    outline: none;
  }
  input:focus {
    border-color: var(--safety-yellow-deep);
  }
  button {
    margin-top: 0.4rem;
    padding: 0.7rem;
    background: var(--ink);
    color: var(--safety-yellow);
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 800;
    font-size: 0.95rem;
    cursor: pointer;
  }
  button:hover {
    transform: translateY(-1px);
  }
  .error {
    margin: 0;
    padding: 0.5rem 0.7rem;
    background: rgba(185, 28, 28, 0.12);
    border: 1px solid #b91c1c;
    border-radius: 8px;
    color: #b91c1c;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .alt {
    margin: 0.2rem 0 0;
    text-align: center;
    font-size: 0.82rem;
    color: var(--ink);
  }
  .alt a {
    color: var(--ink);
    font-weight: 800;
  }
</style>
