const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Check if column exists
        const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='profiles' AND column_name='phone';
    `);

        if (checkRes.rows.length === 0) {
            console.log('Adding phone column...');
            await client.query(`ALTER TABLE public.profiles ADD COLUMN phone text;`);
            console.log('Column phone added successfully.');
        } else {
            console.log('Column phone already exists.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
