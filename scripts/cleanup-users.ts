
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function cleanupUsers() {
    console.log('Cleaning up users table...');
    const allUsers = await db.select().from(users);

    for (const user of allUsers) {
        const parts = user.password.split('.');
        if (parts.length !== 2) {
            console.log(`Deleting user with invalid password: ${user.username} (ID: ${user.id})`);
            await db.delete(users).where(eq(users.id, user.id));
        }
    }

    console.log('Cleanup complete.');
    process.exit(0);
}

cleanupUsers().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
