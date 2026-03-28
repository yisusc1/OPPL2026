const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envFile = path.join(__dirname, '..', '.env.local');

function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return {};
    }
    const content = fs.readFileSync(filePath, 'utf8');

    const env = {};
    // Robust parsing handling CRLF and basic quoting
    const lines = content.replace(/\r\n/g, '\n').split('\n');

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
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

async function findDuplicates() {
    const envVars = parseEnv(envFile);
    console.log(`Trying to read env file at: ${envFile}`);
    // Only log keys to assume debug works without leaking items
    console.log(`Keys found: ${Object.keys(envVars).join(', ')}`);

    const connectionString = envVars.DATABASE_URL || envVars.POSTGRES_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('No connection string found.');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Searching for duplicates...');

        // 1. Get all Active Assignments with their Items
        const res = await client.query(`
            SELECT 
                a.id as assignment_id, 
                a.created_at, 
                a.status,
                items.serials
            FROM inventory_assignments a
            JOIN inventory_assignment_items items ON items.assignment_id = a.id
            WHERE a.status = 'ACTIVE'
        `);

        // 2. Map serials to assignments
        const serialMap = {};

        res.rows.forEach(row => {
            if (row.serials && row.serials.length > 0) {
                // Handle both string array and object array format just in case
                const serial = typeof row.serials[0] === 'string' ? row.serials[0] : row.serials[0].serial;

                if (!serialMap[serial]) {
                    serialMap[serial] = [];
                }
                serialMap[serial].push({
                    id: row.assignment_id,
                    created_at: row.created_at
                });
            }
        });

        // 3. Filter Duplicates
        let duplicateCount = 0;
        Object.keys(serialMap).forEach(serial => {
            if (serialMap[serial].length > 1) {
                console.log(`\nDUPLICATE FOUND: Serial ${serial}`);
                serialMap[serial].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                serialMap[serial].forEach((assign, index) => {
                    console.log(`  [${index}] ID: ${assign.id} | Created: ${assign.created_at} ${index > 0 ? '(ORIGINAL - KEEP)' : '(DUPLICATE - DELETE)'} `);
                });
                duplicateCount++;
            }
        });

        if (duplicateCount === 0) {
            console.log('\nNo duplicates found.');
        } else {
            console.log(`\nFound ${duplicateCount} serials with duplicate assignments.`);
        }

        await client.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

findDuplicates();
