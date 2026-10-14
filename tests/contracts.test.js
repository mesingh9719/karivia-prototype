import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const db=JSON.parse(fs.readFileSync(new URL('../src/data/seed.json',import.meta.url),'utf8'));
test('all service provider IDs exist',()=>{for(const service of db.services)assert.ok(db.providers.some(p=>p.id===service.providerId),service.id)});
test('all booking relationships are valid',()=>{for(const b of db.bookings){assert.ok(db.users.some(u=>u.id===b.customerId));assert.ok(db.providers.some(p=>p.id===b.providerId));assert.ok(db.services.some(s=>s.id===b.serviceId&&s.providerId===b.providerId))}});
test('IDs unique by collection',()=>{for(const [key,records] of Object.entries(db)){assert.equal(new Set(records.map(r=>r.id)).size,records.length,key)}});
test('required frontend files available',()=>{for(const name of ['src/routes.jsx','src/api/client.js','src/services/resourceService.js','vercel.json','.env.example','README.md'])assert.ok(fs.existsSync(new URL('../'+name,import.meta.url)))})
