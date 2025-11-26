import { db } from "../server/db";
import { users, projects, aiModels, promptTemplates, userPreferences } from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function main() {
    console.log("Starting authentication migration...");

    // 1. Create default admin user
    const adminUsername = "admin";
    const adminPassword = "password123"; // Default password, should be changed
    const hashedPassword = await hashPassword(adminPassword);

    console.log(`Creating default user: ${adminUsername}`);

    const [adminUser] = await db.insert(users).values({
        username: adminUsername,
        password: hashedPassword,
        role: "admin",
    }).returning();

    console.log(`Created admin user with ID: ${adminUser.id}`);

    // 2. Link existing projects to admin user
    console.log("Linking existing projects...");
    await db.update(projects).set({ userId: adminUser.id }).where(eq(projects.userId, null as any));

    // 3. Link existing AI models to admin user
    console.log("Linking existing AI models...");
    await db.update(aiModels).set({ userId: adminUser.id }).where(eq(aiModels.userId, null as any));

    // 4. Link existing prompt templates to admin user
    console.log("Linking existing prompt templates...");
    // Note: promptTemplates update might fail if the column doesn't exist yet, 
    // but we assume schema push happens before this script runs or concurrently.
    // Actually, drizzle-kit push will handle the schema change, but data migration needs to happen.
    // If the column is added as nullable (which it is by default for new columns in existing tables usually, or we need to check),
    // then we can update it.

    // Wait, we defined userId as reference. Drizzle might make it not null if we didn't specify.
    // In our schema update we did: userId: varchar("user_id").references(...)
    // By default it is nullable unless .notNull() is called.

    await db.update(promptTemplates).set({ userId: adminUser.id }).where(eq(promptTemplates.userId, null as any));

    console.log("Migration completed successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
