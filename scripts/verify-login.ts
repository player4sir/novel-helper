
import { strict as assert } from 'assert';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function verifyLogin() {
    console.log('Verifying Login...');

    // 1. Create a test user
    const username = `login_test_${Date.now()}`;
    const password = 'password123';
    const hashedPassword = await hashPassword(password);

    console.log(`Creating user: ${username}`);
    const [user] = await db.insert(users).values({
        username,
        password: hashedPassword,
        role: 'user',
        subscriptionTier: 'free'
    }).returning();

    // 2. Simulate Login (Verify Password)
    console.log('Verifying password...');
    const [storedUser] = await db.select().from(users).where(eq(users.username, username));

    const [storedHash, storedSalt] = storedUser.password.split(".");
    assert(storedSalt, 'Salt should exist');

    const passwordBuffer = (await scryptAsync(password, storedSalt, 64)) as Buffer;
    const keyBuffer = Buffer.from(storedHash, "hex");

    if (passwordBuffer.equals(keyBuffer)) {
        console.log('Password verification successful!');
    } else {
        console.error('Password verification failed!');
        process.exit(1);
    }

    // 3. Cleanup
    await db.delete(users).where(eq(users.id, user.id));
    console.log('Cleanup complete.');
    process.exit(0);
}

verifyLogin().catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
});
