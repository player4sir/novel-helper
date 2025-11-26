
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addIndexes() {
    console.log('Adding performance indexes...');
    try {
        // Projects: user_id
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)`);
        console.log('Index added: idx_projects_user_id');

        // Chapters: project_id
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters (project_id)`);
        console.log('Index added: idx_chapters_project_id');

        // Characters: project_id
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters (project_id)`);
        console.log('Index added: idx_characters_project_id');

        // World Settings: project_id
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_world_settings_project_id ON world_settings (project_id)`);
        console.log('Index added: idx_world_settings_project_id');

        // Outlines: project_id
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_outlines_project_id ON outlines (project_id)`);
        console.log('Index added: idx_outlines_project_id');

        console.log('All indexes added successfully.');
    } catch (err) {
        console.error('Failed to add indexes:', err);
        process.exit(1);
    }
    process.exit(0);
}

addIndexes();
