import {sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';

export const cases = sqliteTable('gallery_cases', {
  id: text('id').primaryKey(),
  draft: text('draft').notNull(),
  published: text('published'),
  status: text('status').notNull().default('draft'),
  revision: integer('revision').notNull().default(1),
  updatedBy: text('updated_by').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const photos = sqliteTable('gallery_photos', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  storageKey: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: text('created_at').notNull(),
});
export const staff = sqliteTable('gallery_staff', {
  email: text('email').primaryKey(),
  role: text('role').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const history = sqliteTable('gallery_history', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull(),
  revision: integer('revision').notNull(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  createdAt: text('created_at').notNull(),
});
