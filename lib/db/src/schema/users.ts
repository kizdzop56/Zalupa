import { pgTable, text, serial, integer, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["student", "parent", "admin", "teacher"]);

export const knowledgeLevelEnum = pgEnum("knowledge_level", [
  "starter",
  "beginner",
  "elementary",
  "intermediate",
  "upper_intermediate",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("student"),
  age: integer("age"),
  dateOfBirth: date("date_of_birth"),
  knowledgeLevel: knowledgeLevelEnum("knowledge_level"),
  parentId: integer("parent_id"),
  totalPoints: integer("total_points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
