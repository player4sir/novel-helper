
import { db } from "../server/db";
import { users } from "../shared/schema";

async function main() {
    try {
        const allUsers = await db.select().from(users);
        console.log("Users found:", allUsers.length);
        allUsers.forEach(u => {
            console.log(`ID: ${u.id}, Username: ${u.username}, Role: ${u.role}`);
        });
    } catch (error) {
        console.error("Error querying users:", error);
    }
    process.exit(0);
}

main();
