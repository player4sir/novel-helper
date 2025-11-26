
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addIndex() {
    console.log('Adding unique index manually...');
    try {
        await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_date_unique ON user_usage (user_id, date)`);
        console.log('Index added successfully.');
    } catch (err) {
        console.error('Failed to add index:', err);
        process.exit(1);
    }
    process.exit(0);
}

addIndex();
