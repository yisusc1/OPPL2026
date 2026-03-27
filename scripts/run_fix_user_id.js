const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationFile = path.join(__dirname, '..', 'fix_user_id_column.sql');
const envFile = path.join(__dirname, '..', '.env.local');

// Helper to parse .env file
function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    });
    return env;
}

async function runMigration() {
    const envVars = parseEnv(envFile);

    // Prioritize DATABASE_URL or POSTGRES_URL
    const connectionString = envVars.DATABASE_URL || envVars.POSTGRES_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('No connection string found in .env.local (DATABASE_URL or POSTGRES_URL).');
        process.exit(1);
    }

    // Check if password is placeholder
    if (connectionString.includes('[YOUR-PASSWORD]')) {
        console.error('Connection string in .env.local contains a placeholder. Please update it with the real password.');
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('Read migration file.');

    // Create client (SSL usually needed for Supabase)
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for some Supabase connections
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully.');

        await client.query(sql);
        console.log('Migration executed successfully.');

        await client.end();
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
