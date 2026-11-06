import {sqliteTable,text,integer,check,uniqueIndex} from "drizzle-orm/sqlite-core";
import {sql} from "drizzle-orm";
export const users=sqliteTable("users",{id:text().primaryKey(),login:text().notNull().unique(),name:text().notNull(),salt:text().notNull(),hash:text().notNull(),role:text().notNull()},t=>[uniqueIndex("single_owner").on(t.role).where(sql`role='seller'`)]);
export const sessions=sqliteTable("sessions",{id:text().primaryKey(),uid:text().notNull(),expires:integer().notNull()});
export const limits=sqliteTable("limits",{id:text().primaryKey(),count:integer().notNull(),expires:integer().notNull()});
export const settings=sqliteTable("settings",{id:integer().primaryKey(),name:text().notNull(),phone:text().notNull(),pickup:text().notNull(),fee:integer().notNull()});
export const products=sqliteTable("products",{id:text().primaryKey(),category:text().notNull(),info:text().notNull(),price:integer().notNull(),stock:integer().notNull(),hidden:integer().notNull(),created:integer().notNull(),version:integer().notNull()},t=>[check("available",sql`stock>=0`)]);
export const orders=sqliteTable("orders",{id:text().primaryKey(),uid:text().notNull(),nonce:text().notNull(),info:text().notNull(),total:integer().notNull(),status:text().notNull(),created:integer().notNull()},t=>[uniqueIndex("request_once").on(t.uid,t.nonce)]);
