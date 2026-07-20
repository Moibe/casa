import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { verifyPassword, createSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(302, '/');
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');
    if (!email || !password) {
      return fail(400, { email, error: 'Escribe tu email y contraseña.' });
    }
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail(400, { email, error: 'Email o contraseña incorrectos.' });
    }
    cookies.set(SESSION_COOKIE, createSession(user.id), sessionCookieOptions);
    throw redirect(302, '/');
  }
};
