import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

// El editor es un canvas Three.js puro cliente: no tiene sentido renderizarlo en SSR,
// y así el estado del usuario nunca toca el singleton `studio` en el servidor.
export const ssr = false;

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const rows = db
    .select({ id: projects.id, name: projects.name, data: projects.data, version: projects.version })
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(desc(projects.updatedAt))
    .all();
  return { user: locals.user, projects: rows };
};

export const actions: Actions = {
  logout: async ({ cookies }) => {
    const sid = cookies.get(SESSION_COOKIE);
    if (sid) invalidateSession(sid);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(302, '/login');
  }
};
