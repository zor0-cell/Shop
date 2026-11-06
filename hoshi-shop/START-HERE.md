# Hoshi Shop — run on Windows

Extract the ZIP. Open the hoshi-shop folder in VS Code or File Explorer and start PowerShell there. Use a development PC with Node.js 24 and npm installed.

## First run

Run these commands in order. Stop if a command reports an error.

```powershell
node --version
npx.cmd --yes pnpm@11.25.0 install --frozen-lockfile
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tiny_zuras.sql
npm.cmd start
```

The database command initializes a fresh local database. Run it once per new database. Open the local URL printed in the terminal. Nine demo products appear on the first visit. Local orders, accounts and photos are stored separately from the published shop.

## Seller access

Add /#activate to the local shop URL, enter the owner activation code provided in the original handoff, set a password, and use the username owner. Your local installation has its own seller account. OWNER.md explains how to replace demo products, upload photos, set a pickup address and manage orders.

## Next time

Run `npm.cmd start` from the project folder. For live editing, run `npm.cmd run dev` and open the URL it prints. Rebuild with `npm.cmd run build` to update the built version.

## Main project files

- public/shop.js — storefront, shopping cart, checkout and seller dashboard
- public/catalog.js — nine starter products
- public/art/ — hero illustration, category images and product photos
- app/globals.css — desktop and mobile layout
- lib/shop.mjs — server-side accounts, orders, stock and permissions
- db/schema.ts and drizzle/ — database schema and initial migration

This source snapshot matches published commit 2705b0d8d912b7fa10c842b2a56af9057f934ac3. START-HERE.md is included as a download guide.
