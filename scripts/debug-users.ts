
import { db } from '../server/db';
import { users } from '../shared/schema';

async function debugUsers() {
    console.log('Checking users table...');
    const allUsers = await db.select().from(users);

    for (const user of allUsers) {
        const parts = user.password.split('.');
        if (parts.length !== 2) {
            console.error(`Invalid password format for user: ${user.username} (ID: ${user.id})`);
            console.error(`Password: ${user.password}`);
        } else {
            console.log(`Valid password format for user: ${user.username}`);
        }
    }

    process.exit(0);
}

debugUsers().catch((err) => {
    console.error('Debug failed:', err);
    process.exit(1);
});
