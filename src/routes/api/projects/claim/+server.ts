import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const MAX_BYTES = 5_000_000;

// Migración del primer login: sube los proyectos de localStorage.
// Idempotente: unique(user_id, client_local_id) + onConflictDoNothing => reintentar no duplica.
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401);
  const userId = locals.user.id;
  const body = await request.json();
  const incoming: Array<{ localId?: unknown; name?: unknown; data?: unknown }> = Array.isArray(
    body?.projects
  )
    ? body.projects
    : [];

  let claimed = 0;
  db.transaction((tx) => {
    const now = Date.now();
    for (const p of incoming) {
      const localId = typeof p.localId === 'string' ? p.localId : null;
      if (!localId) continue;
      const data = typeof p.data === 'string' ? p.data : JSON.stringify(p.data ?? {});
      if (data.length > MAX_BYTES) continue;
      const name = typeof p.name === 'string' && p.name.trim() ? p.name : 'Proyecto';
      const res = tx
        .insert(projects)
        .values({
          id: randomUUID(),
          userId,
          name,
          data,
          schemaVersion: 1,
          version: 0,
          clientLocalId: localId,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoNothing()
        .run();
      claimed += res.changes;
    }
  });

  return json({ ok: true, claimed });
};
