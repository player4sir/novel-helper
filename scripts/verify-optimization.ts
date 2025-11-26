
import { strict as assert } from 'assert';
import { storage } from '../server/storage';
import { db } from '../server/db';
import { users, userUsage } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function verifyAtomicUpdates() {
    console.log('Verifying Atomic Updates...');

    // 1. Create a test user
    const username = `atomic_test_${Date.now()}`;
    const user = await storage.createUser(username, 'password123');
    console.log(`Created test user: ${user.id}`);

    try {
        // 2. Simulate concurrent usage tracking
        const CONCURRENT_REQUESTS = 10;
        console.log(`Simulating ${CONCURRENT_REQUESTS} concurrent requests...`);

        const promises = [];
        for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
            promises.push(storage.trackUsage(user.id, 'ai_request', 1));
        }

        await Promise.all(promises);

        // 3. Verify the count
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const usage = await storage.getUserUsage(user.id, today);
        console.log(`Usage count: ${usage?.aiRequestCount}`);

        if (usage?.aiRequestCount === CONCURRENT_REQUESTS) {
            console.log('SUCCESS: Atomic update verified!');
        } else {
            console.error(`FAILURE: Expected ${CONCURRENT_REQUESTS}, got ${usage?.aiRequestCount}`);
            process.exit(1);
        }

    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    } finally {
        // 4. Cleanup
        await db.delete(userUsage).where(eq(userUsage.userId, user.id));
        await db.delete(users).where(eq(users.id, user.id));
        console.log('Cleanup complete.');
    }

    process.exit(0);
}

verifyAtomicUpdates().catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
});
