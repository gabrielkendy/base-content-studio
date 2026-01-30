const { Client } = require('pg');
const fs = require('fs');

// Supabase connection (session mode via pooler)
// Try direct connection first, then pooler
const connConfig = {
  host: 'db.gpqxqykgcrpmvwxktjvp.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.argv[2] || '',
  ssl: { rejectUnauthorized: false }
};
const client = new Client(connConfig);

async function run() {
  try {
    console.log('Connecting to Supabase DB...');
    await client.connect();
    console.log('Connected!');
    
    const sql = fs.readFileSync(__dirname + '/migrate.sql', 'utf8');
    console.log('Running migration...');
    await client.query(sql);
    console.log('✅ Migration complete!');
    
    // Insert empresas
    const empresas = [
      { nome: 'The Beat Life Club', slug: 'beatlife', cores: '{"primaria": "#0c1f32", "secundaria": "#1a3a5c"}' },
      { nome: 'Manchester', slug: 'manchester', cores: '{"primaria": "#C41E3A", "secundaria": "#C9A227"}' },
      { nome: 'Nechio Congelados', slug: 'nechio', cores: '{"primaria": "#6366F1", "secundaria": "#818CF8"}' },
      { nome: 'FlexByo', slug: 'flexbyo', cores: '{"primaria": "#10B981", "secundaria": "#34D399"}' },
      { nome: 'Just Burn', slug: 'justburn', cores: '{"primaria": "#F59E0B", "secundaria": "#FBBF24"}' },
      { nome: 'RT', slug: 'rt', cores: '{"primaria": "#EF4444", "secundaria": "#F87171"}' },
    ];
    
    for (const e of empresas) {
      await client.query(
        `INSERT INTO empresas (nome, slug, cores) VALUES ($1, $2, $3::jsonb) ON CONFLICT (slug) DO NOTHING`,
        [e.nome, e.slug, e.cores]
      );
    }
    console.log('✅ Empresas inserted!');
    
    // Verify
    const res = await client.query('SELECT nome, slug FROM empresas ORDER BY nome');
    console.log('Empresas:', res.rows.map(r => r.nome).join(', '));
    
    const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
