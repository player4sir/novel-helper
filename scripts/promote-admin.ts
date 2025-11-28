
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    try {
        const username = "atomic_test_1764161707944"; // The user found in previous step
        console.log(`Promoting user ${username} to admin...`);

        await db.update(users)
            .set({ role: "admin" })
            .where(eq(users.username, username));

        console.log("User promoted successfully.");
    } catch (error) {
        console.error("Error promoting user:", error);
    }
    process.exit(0);
}

main();
