import { sqliteTable,text,integer } from 'drizzle-orm/sqlite-core';
export const projects=sqliteTable('projects',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),payload:text('payload').notNull(),updated:integer('updated').notNull()});
export const jobs=sqliteTable('analysis_jobs',{id:text('id').primaryKey(),owner:text('owner').notNull(),day:text('day').notNull(),status:text('status').notNull(),result:text('result'),created:integer('created').notNull()});
