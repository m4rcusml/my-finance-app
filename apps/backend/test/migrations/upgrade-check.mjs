/**
 * Proves the V1 migration upgrades a *populated* pre-V1 database without losing
 * data and while repairing every invariant violation.
 * Run from apps/backend with DATABASE_URL pointing at a scratch database.
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const MIGRATIONS = 'prisma/migrations'
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL required')

const client = new pg.Client({ connectionString: url })
await client.connect()

const apply = async (name) => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, name, 'migration.sql'), 'utf8')
  await client.query(sql)
  console.log(`  applied ${name}`)
}

console.log('1) old schema')
await apply('20251125204546_init')
await apply('20251210015148_optional_description')

console.log('2) legacy data (messy on purpose)')
await client.query(`INSERT INTO users (id,email,password_hash,name,created_at,updated_at) VALUES
 ('u1','a@x.com','h','A',NOW(),NOW()), ('u2','b@x.com','h','B',NOW(),NOW())`)
await client.query(`INSERT INTO accounts (id,user_id,name,institution,type,initial_balance,is_active,created_at,updated_at) VALUES
 ('a1','u1','Conta','Inter','CHECKING',100.00,true,NOW(),NOW()),
 ('a2','u1','Poupanca','Inter','savings',50.00,false,NOW(),NOW()),
 ('a3','u2','Conta B','BB','weird-type',0,true,NOW(),NOW())`)
await client.query(`INSERT INTO credit_cards (id,user_id,name,institution,limit_total,closing_day,is_active,created_at,updated_at) VALUES
 ('c1','u1','Cartao','Inter',1000.00,10,true,NOW(),NOW())`)
await client.query(`INSERT INTO categories (id,user_id,name,type,created_at,updated_at) VALUES
 ('cat1','u1','Mercado','EXPENSE','2026-01-01','2026-01-01'),
 ('cat2','u1','Mercado','EXPENSE','2026-01-02','2026-01-02'),
 ('cat3','u1','Salario','income',NOW(),NOW()),
 ('cat4','u2','Outros','both',NOW(),NOW())`)
await client.query(`INSERT INTO transactions (id,user_id,type,value,date,account_id,credit_card_id,category_id,description,source,external_id,created_at,updated_at) VALUES
 ('t1','u1','EXPENSE',10.50,'2026-01-15T00:00:00','a1',NULL,'cat1','compra','manual',NULL,NOW(),NOW()),
 ('t2','u1','income',20.00,'2026-01-31T00:00:00','a1','c1',NULL,'ambos','MANUAL',NULL,NOW(),NOW()),
 ('t3','u1','expense',5.00,'2026-02-28T00:00:00',NULL,NULL,NULL,'orfa','imported','EXT-1',NOW(),NOW()),
 ('t4','u1','expense',7.25,'2026-03-01T00:00:00',NULL,'c1','cat1','cartao','manual',NULL,NOW(),NOW())`)
await client.query(`INSERT INTO fixed_transactions (id,user_id,type,value,reference_day,margin_days,account_id,credit_card_id,category_id,description,is_active,created_at,updated_at) VALUES
 ('f1','u1','EXPENSE',99.00,31,2,'a1',NULL,'cat1','aluguel',true,NOW(),NOW()),
 ('f2','u1','expense',10.00,5,0,'ghost-account',NULL,'cat1','fk quebrada',false,NOW(),NOW())`)
await client.query(`INSERT INTO fixed_transaction_occurrences (id,fixed_transaction_id,user_id,period_year,period_month,status,real_date,transaction_id,created_at,updated_at) VALUES
 ('o1','f1','u1',2026,2,'PENDING',NULL,NULL,NOW(),NOW()),
 ('o2','f1','u1',2026,1,'CONFIRMED','2026-01-31T00:00:00','t1',NOW(),NOW()),
 ('o3','f2','u1',2026,1,'skipped',NULL,NULL,NOW(),NOW())`)
await client.query(`INSERT INTO market_assets (id,user_id,symbol,type,exchange,name,created_at,updated_at) VALUES
 ('m1','u1','PETR4','STOCK','B3','Petro',NOW(),NOW()),
 ('m2',NULL,'VALE3','stock','B3','Vale',NOW(),NOW()),
 ('m3',NULL,'BTC','CRYPTO','Binance','Bitcoin',NOW(),NOW())`)
await client.query(`INSERT INTO investments (id,user_id,market_asset_id,broker,type,quantity,buy_price,invested_amount,buy_date,created_at,updated_at) VALUES
 ('i1','u1','m1','Inter','stock',10.00000000,30.00,300.00,'2026-01-10T00:00:00',NOW(),NOW()),
 ('i2','u2','m1','XP','fixed-income',1.00000000,100.00,100.00,'2026-01-11T00:00:00',NOW(),NOW()),
 ('i3','u2','m2','XP','stock',2.00000000,60.00,120.00,'2026-01-12T00:00:00',NOW(),NOW())`)
await client.query(`INSERT INTO goals (id,user_id,name,type,target_amount,current_amount,deadline,related_category_id,related_account_id,created_at,updated_at) VALUES
 ('g1','u1','Viagem','SAVINGS',5000.00,NULL,'2026-12-31T00:00:00','cat1','a1',NOW(),NOW())`)
await client.query(`INSERT INTO imported_files (id,user_id,origin,file_name,file_type,status,imported_at,total_records,created_at,updated_at) VALUES
 ('if1','u1','INTER','extrato.csv','CSV','completed',NOW(),3,NOW(),NOW())`)

const before = {}
for (const t of ['users', 'accounts', 'credit_cards', 'categories', 'transactions', 'fixed_transactions', 'fixed_transaction_occurrences', 'market_assets', 'investments', 'goals', 'imported_files']) {
  before[t] = Number((await client.query(`SELECT count(*)::int c FROM "${t}"`)).rows[0].c)
}

console.log('3) upgrade')
await apply('20260903120000_v1_invariants')

console.log('4) assertions')
const failures = []
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` -> got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`)
  if (!ok) failures.push(label)
}
const one = async (sql) => (await client.query(sql)).rows[0]
const all = async (sql) => (await client.query(sql)).rows

// nothing lost (accounts gains exactly the one placeholder)
for (const [t, n] of Object.entries(before)) {
  const c = Number((await client.query(`SELECT count(*)::int c FROM "${t}"`)).rows[0].c)
  check(`row count preserved: ${t}`, c, t === 'accounts' ? n + 1 : n)
}

check('account type normalised CHECKING->checking', (await one(`SELECT type FROM accounts WHERE id='a1'`)).type, 'checking')
check('account unknown type -> other', (await one(`SELECT type FROM accounts WHERE id='a3'`)).type, 'other')
check('inactive account got archived_at', (await one(`SELECT (archived_at IS NOT NULL) x FROM accounts WHERE id='a2'`)).x, true)
check('duplicate category renamed, both kept', (await all(`SELECT name FROM categories WHERE user_id='u1' AND name LIKE 'Mercado%' ORDER BY name`)).map(r => r.name), ['Mercado', 'Mercado (2)'])
check('category type EXPENSE->expense', (await one(`SELECT type FROM categories WHERE id='cat1'`)).type, 'expense')

check('civil date preserved exactly', (await one(`SELECT to_char(date,'YYYY-MM-DD') d FROM transactions WHERE id='t1'`)).d, '2026-01-15')
check('civil date end-of-month preserved', (await one(`SELECT to_char(date,'YYYY-MM-DD') d FROM transactions WHERE id='t3'`)).d, '2026-02-28')
check('both-ids row keeps account, drops card', (await one(`SELECT account_id, credit_card_id FROM transactions WHERE id='t2'`)), { account_id: 'a1', credit_card_id: null })
check('orphan row attached to placeholder', (await one(`SELECT (account_id IS NOT NULL) a, (credit_card_id IS NULL) c FROM transactions WHERE id='t3'`)), { a: true, c: true })
check('placeholder account is archived', (await one(`SELECT is_active FROM accounts WHERE name LIKE 'Conta n%o especificada%'`)).is_active, false)
check('card-only row untouched', (await one(`SELECT account_id, credit_card_id FROM transactions WHERE id='t4'`)), { account_id: null, credit_card_id: 'c1' })
check('transaction source MANUAL->manual', (await one(`SELECT source FROM transactions WHERE id='t2'`)).source, 'manual')

check('occurrence status PENDING->pending', (await one(`SELECT status FROM fixed_transaction_occurrences WHERE id='o1'`)).status, 'pending')
check('occurrence status CONFIRMED->confirmed', (await one(`SELECT status FROM fixed_transaction_occurrences WHERE id='o2'`)).status, 'confirmed')
check('due_date clamps day 31 in february', (await one(`SELECT to_char(due_date,'YYYY-MM-DD') d FROM fixed_transaction_occurrences WHERE id='o1'`)).d, '2026-02-28')
check('due_date keeps day 31 in january', (await one(`SELECT to_char(due_date,'YYYY-MM-DD') d FROM fixed_transaction_occurrences WHERE id='o2'`)).d, '2026-01-31')
check('occurrence snapshot backfilled', (await one(`SELECT type, value::text, category_id FROM fixed_transaction_occurrences WHERE id='o1'`)), { type: 'expense', value: '99.00', category_id: 'cat1' })
check('dangling fixed account_id repaired to placeholder', (await one(`SELECT (account_id IS NOT NULL) a FROM fixed_transactions WHERE id='f2'`)).a, true)

check('ownerless-but-used asset got its holder', (await one(`SELECT user_id FROM market_assets WHERE id='m2'`)).user_id, 'u2')
check('ownerless unused asset preserved', (await one(`SELECT count(*)::int c FROM market_assets WHERE id='m3'`)).c, 1)
check('cross-tenant investment detached', (await one(`SELECT market_asset_id FROM investments WHERE id='i2'`)).market_asset_id, null)
check('same-tenant investment kept', (await one(`SELECT market_asset_id FROM investments WHERE id='i1'`)).market_asset_id, 'm1')
check('investment fixed-income normalised', (await one(`SELECT type FROM investments WHERE id='i2'`)).type, 'fixed_income')
check('buy_date is a civil date', (await one(`SELECT to_char(buy_date,'YYYY-MM-DD') d FROM investments WHERE id='i1'`)).d, '2026-01-10')

check('goal SAVINGS->saving', (await one(`SELECT type FROM goals WHERE id='g1'`)).type, 'saving')
check('goal null current_amount -> 0', (await one(`SELECT current_amount::text v FROM goals WHERE id='g1'`)).v, '0.00')
check('imported_file origin INTER->inter', (await one(`SELECT origin FROM imported_files WHERE id='if1'`)).origin, 'inter')
check('imported_file type CSV->csv', (await one(`SELECT file_type FROM imported_files WHERE id='if1'`)).file_type, 'csv')

// constraints actually enforce
const expectFail = async (label, sql) => {
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('ROLLBACK')
    console.log(`  FAIL  ${label} (statement unexpectedly succeeded)`)
    failures.push(label)
  } catch {
    await client.query('ROLLBACK')
    console.log(`  PASS  ${label}`)
  }
}
await expectFail('CHECK rejects two sources', `INSERT INTO transactions (id,user_id,type,value,date,account_id,credit_card_id,source,created_at,updated_at) VALUES ('x1','u1','expense',1,'2026-01-01','a1','c1','manual',NOW(),NOW())`)
await expectFail('CHECK rejects zero sources', `INSERT INTO transactions (id,user_id,type,value,date,account_id,credit_card_id,source,created_at,updated_at) VALUES ('x2','u1','expense',1,'2026-01-01',NULL,NULL,'manual',NOW(),NOW())`)
await expectFail('unique externalId per user', `INSERT INTO transactions (id,user_id,type,value,date,account_id,external_id,source,created_at,updated_at) VALUES ('x3','u1','expense',1,'2026-01-01','a1','EXT-1','imported',NOW(),NOW())`)
await expectFail('FK blocks deleting an account with history', `DELETE FROM accounts WHERE id='a1'`)
await expectFail('FK blocks deleting a template with occurrences', `DELETE FROM fixed_transactions WHERE id='f1'`)
await expectFail('confirmed occurrence must have a transaction', `UPDATE fixed_transaction_occurrences SET status='confirmed' WHERE id='o1'`)

// idempotency of re-running the whole deploy is Prisma's job; check the guard table instead
await client.end()
console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL UPGRADE ASSERTIONS PASSED')
process.exit(failures.length ? 1 : 0)
