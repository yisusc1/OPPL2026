const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Try common local Postgres ports
const possiblePorts = [54322, 5432, 6432];

async function runMigration() {
    let client;

    // 1. Establish connection to local Supabase/Postgres
    // Note: User's environment seems to be using standard postgres creds based on previous scripts
    for (const port of possiblePorts) {
        const connectionString = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
        console.log(`Trying connection to ${connectionString}...`);

        try {
            client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
            await client.connect();
            console.log("Connected successfully to port " + port);
            break;
        } catch (e) {
            console.log(`Failed for port ${port}: ${e.message}`);
            client = null;
        }
    }

    if (!client) {
        console.error("Could not connect to any standard local Postgres port.");
        process.exit(1);
    }

    // 2. Run Migration
    try {
        const file = 'soportes_migration.sql';
        console.log(`Reading ${file}...`);
        const filePath = path.join(__dirname, '..', file);

        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Executing ${file}...`);
        await client.query(sql);
        console.log(`Success: Migration applied.`);

    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        if (client) {
            await client.end();
            console.log("Disconnected.");
        }
    }
}

runMigration();
