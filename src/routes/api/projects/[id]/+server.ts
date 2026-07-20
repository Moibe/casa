import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const MAX_BYTES = 5_000_000;

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401);
  const body = await request.json();
  const name = typeof body.name === 'string' && body.name.trim() ? body.name : 'Proyecto';
  const data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? {});
  const version = Number.isFinite(body.version) ? Number(body.version) : 0;
  if (data.length > MAX_BYTES) throw error(413, 'Proyecto demasiado grande.');

  const now = Date.now();
  const res = db
    .update(projects)
    .set({ name, data, updatedAt: now, version: version + 1 })
    .where(
      and(
        eq(projects.id, params.id),
        eq(projects.userId, locals.user.id),
        eq(projects.version, version)
      )
    )
    .run();

  if (res.changes === 0) {
    // ¿existe pero con otra versión (conflicto), o no es tuyo/no existe (404)?
    const current = db
      .select({ version: projects.version })
      .from(projects)
      .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)))
      .get();
    if (!current) throw error(404);
    return json({ conflict: true, serverVersion: current.version }, { status: 409 });
  }
  return json({ version: version + 1 });
};

export const DELETE: RequestHandler = ({ locals, params }) => {
  if (!locals.user) throw error(401);
  db.delete(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)))
    .run();
  return json({ ok: true });
};
