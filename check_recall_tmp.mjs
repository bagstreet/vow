import { MemWal } from "@mysten-incubation/memwal";
const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: process.env.MEMWAL_SERVER_URL,
  requestTimeoutMs: 20000,
});
const userId = process.argv[2];
for (let i=0;i<12;i++) {
  await new Promise(r=>setTimeout(r,3000));
  try {
    const r = await memwal.recall({ query: "peanuts", namespace: `vow:mem:${userId}`, limit: 5 });
    if (r.results?.length) { console.log("FOUND:", JSON.stringify(r.results)); process.exit(0); }
    console.log("poll", i, "no results yet");
  } catch(e) { console.log("recall err:", e.message); }
}
console.log("NOT FOUND after polling");
