import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMemWal} from '../packages/core/memwal.mjs';
test('P0 parent: production cannot silently use mock', async()=>{
 await assert.rejects(()=>createMemWal({NODE_ENV:'production'}), /Production requires/);
});
test('P0 parent: explicit mock is not a production configuration', async()=>{
 await assert.rejects(()=>createMemWal({NODE_ENV:'production',MEMWAL_MODE:'mock'}), /Production requires/);
});
