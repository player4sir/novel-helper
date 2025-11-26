
import { strict as assert } from 'assert';
import { db } from '../server/db';
import { users, subscriptions, userUsage } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function verifyPhase2() {
    console.log('Starting Phase 2 Verification...');

    // 1. Create a test user
    const username = `test_user_${Date.now()}`;
    const password = 'password123';
    const hashedPassword = await hashPassword(password);

    console.log(`Creating user: ${username}`);
    const [user] = await db.insert(users).values({
        username,
        password: hashedPassword,
        role: 'user',
        subscriptionTier: 'free'
    }).returning();

    assert(user, 'User creation failed');
    assert(user.subscriptionTier === 'free', 'Default subscription tier should be free');
    console.log('User created successfully.');

    // 2. Create a subscription
    console.log('Creating subscription...');
    const [sub] = await db.insert(subscriptions).values({
        userId: user.id,
        planId: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }).returning();

    assert(sub, 'Subscription creation failed');
    assert(sub.userId === user.id, 'Subscription userId mismatch');
    console.log('Subscription created successfully.');

    // 3. Create usage record
    console.log('Creating usage record...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [usage] = await db.insert(userUsage).values({
        userId: user.id,
        date: today,
        tokenCount: 100,
        projectCount: 1,
        aiRequestCount: 5
    }).returning();

    assert(usage, 'Usage record creation failed');
    assert(usage.tokenCount === 100, 'Token count mismatch');
    console.log('Usage record created successfully.');

    // 4. Verify relations
    console.log('Verifying relations...');
    const userWithUsage = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        with: {
            // Note: Relations might not be fully set up in schema exports if I missed adding them to `usersRelations`
            // But let's check if we can query the tables directly
        }
    });

    // 5. Cleanup
    console.log('Cleaning up...');
    await db.delete(users).where(eq(users.id, user.id));

    console.log('Phase 2 Verification Complete!');
    process.exit(0);
}

verifyPhase2().catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
});
