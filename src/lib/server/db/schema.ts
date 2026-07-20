import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull()
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Blob JSON del proyecto (shapes/rooms/floors/…), opaco para el servidor.
  data: text('data').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  // Concurrencia optimista: el cliente manda la versión que tenía; si no coincide, no se pisa.
  version: integer('version').notNull().default(0),
  // Id original de localStorage, para que el "claim" del primer login sea idempotente.
  clientLocalId: text('client_local_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Project = typeof projects.$inferSelect;
