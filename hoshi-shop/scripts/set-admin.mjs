// Установка логина и пароля владельца (администратора) в локальной базе.
// Запуск из папки hoshi-shop:   node scripts/set-admin.mjs
// Остановите магазин (Ctrl+C) перед запуском. Пароль нигде не сохраняется в файлах.
import {createInterface} from 'node:readline/promises';
import {pbkdf2Sync, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync, rmSync, existsSync} from 'node:fs';

if (!existsSync('dist/server/wrangler.json')) {
  console.error('Не найден dist/server/wrangler.json. Сначала выполните: npm.cmd run build');
  process.exit(1);
}

const rl = createInterface({input: process.stdin, output: process.stdout});
const login = (process.env.ADMIN_LOGIN || (await rl.question('Новый логин владельца: '))).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || await rl.question('Новый пароль (от 8 символов): ');
const name = (process.env.ADMIN_NAME || (await rl.question('Отображаемое имя (Enter = как логин): '))).trim() || login;
rl.close();

if (!/^[\p{L}\p{N}_.-]{3,40}$/u.test(login)) { console.error('Логин: 3–40 символов (буквы, цифры, _ . -).'); process.exit(1); }
if (password.length < 8 || password.length > 128) { console.error('Пароль должен быть от 8 до 128 символов.'); process.exit(1); }
if (name.length > 80) { console.error('Имя слишком длинное (до 80 символов).'); process.exit(1); }

// Тот же алгоритм, что в lib/shop.mjs: PBKDF2-SHA256, 100000 итераций, соль — строка UTF-8.
const salt = randomUUID();
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
const q = s => "'" + String(s).replaceAll("'", "''") + "'";

const sql = `
UPDATE users SET login=${q(login)},name=${q(name)},salt=${q(salt)},hash=${q(hash)} WHERE role='seller';
INSERT INTO users(id,login,name,salt,hash,role) SELECT ${q(randomUUID())},${q(login)},${q(name)},${q(salt)},${q(hash)},'seller' WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='seller');
DELETE FROM sessions WHERE uid IN (SELECT id FROM users WHERE role='seller');
DELETE FROM limits;
`;
const file = '.set-admin.tmp.sql';
writeFileSync(file, sql);
try {
  const r = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js',
    'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--file', file],
    {stdio: 'inherit'});
  if (r.status !== 0) { console.error('\nОшибка. Если база ещё не создана, выполните команду создания базы из START-HERE.md.'); process.exit(r.status || 1); }
  console.log(`\nГотово. Войдите через кнопку «Войти»: логин «${login}», ваш пароль.`);
} finally {
  rmSync(file, {force: true});
}