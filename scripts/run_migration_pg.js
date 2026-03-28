const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const possiblePorts = [54322, 5432, 6432];

async function runMigration() {
    let client;

    // 1. Establish connection
    for (const port of possiblePorts) {
        const connectionString = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
        console.log(`Trying connection to ${connectionString}...`);

        try {
            client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
            await client.connect();
            console.log("Connected successfully to port " + port);
            break; // Valid connection found
        } catch (e) {
            console.log(`Failed for port ${port}: ${e.message}`);
            client = null;
        }
    }

    if (!client) {
        console.error("Could not connect to any standard local Postgres port.");
        process.exit(1);
    }

    // 2. Run Migrations
    try {
        const filesToRun = [
            'migration_system_settings.sql',
            'relax_settings_rls.sql',
            'fix_permissions_settings.sql'
        ];

        for (const file of filesToRun) {
            console.log(`Reading ${file}...`);
            const filePath = path.join(__dirname, '..', file);
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                continue;
            }

            const sql = fs.readFileSync(filePath, 'utf8');
            console.log(`Executing ${file}...`);
            await client.query(sql);
            console.log(`Success: ${file}`);
        }

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
