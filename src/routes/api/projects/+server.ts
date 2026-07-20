import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const MAX_BYTES = 5_000_000;

export const GET: RequestHandler = ({ locals }) => {
  if (!locals.user) throw error(401);
  const rows = db
    .select({ id: projects.id, name: projects.name, data: projects.data, version: projects.version })
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(desc(projects.updatedAt))
    .all();
  return json({ projects: rows });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401);
  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : randomUUID();
  const name = typeof body.name === 'string' && body.name.trim() ? body.name : 'Proyecto';
  const data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? {});
  if (data.length > MAX_BYTES) throw error(413, 'Proyecto demasiado grande.');
  const now = Date.now();
  db.insert(projects)
    .values({
      id,
      userId: locals.user.id,
      name,
      data,
      schemaVersion: 1,
      version: 0,
      clientLocalId: null,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return json({ id, version: 0 });
};
