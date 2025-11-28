
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function main() {
    try {
        // 1. Demote previous admin
        const oldAdminUsername = "atomic_test_1764161707944";
        console.log(`Demoting old admin ${oldAdminUsername}...`);
        await db.update(users)
            .set({ role: "user" })
            .where(eq(users.username, oldAdminUsername));

        // 2. Setup new admin 'player4sir'
        const newAdminUsername = "player4sir";
        const newAdminPassword = "123456";

        console.log(`Setting up admin ${newAdminUsername}...`);

        const hashedPassword = await hashPassword(newAdminPassword);

        const [existingUser] = await db.select().from(users).where(eq(users.username, newAdminUsername));

        if (existingUser) {
            console.log("User exists, updating password and role...");
            await db.update(users)
                .set({
                    password: hashedPassword,
                    role: "admin"
                })
                .where(eq(users.username, newAdminUsername));
        } else {
            console.log("User does not exist, creating new admin...");
            await db.insert(users).values({
                username: newAdminUsername,
                password: hashedPassword,
                role: "admin",
                subscriptionTier: "pro", // Give them pro tier as well
            });
        }

        console.log("Admin setup complete.");
    } catch (error) {
        console.error("Error setting up admin:", error);
    }
    process.exit(0);
}

main();
