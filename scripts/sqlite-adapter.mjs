import { DatabaseSync } from 'node:sqlite';
export function database(file = ':memory:') {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys=ON');
  const prepare = sql => {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
    };
  };
  return {
    prepare, exec: sql => sqlite.exec(sql), close: () => sqlite.close(),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result; }
      catch(e){sqlite.exec('ROLLBACK');throw e;}
    }
  };
}
