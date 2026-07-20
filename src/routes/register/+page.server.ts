import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, createSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth';
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
    if (!email || !email.includes('@')) {
      return fail(400, { email, error: 'Escribe un email válido.' });
    }
    if (password.length < 6) {
      return fail(400, { email, error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
    if (existing) {
      return fail(400, { email, error: 'Ya existe una cuenta con ese email.' });
    }
    const id = randomUUID();
    db.insert(users).values({ id, email, passwordHash: hashPassword(password), createdAt: Date.now() }).run();
    cookies.set(SESSION_COOKIE, createSession(id), sessionCookieOptions);
    throw redirect(302, '/');
  }
};
