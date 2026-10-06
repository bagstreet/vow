const tokenEl = document.querySelector("#token");
const vowEl = document.querySelector("#vow");
const thread = document.querySelector("#thread");
const summary = document.querySelector("#summary");
const chain = document.querySelector("#chain");

function headers() {
  return { authorization: `Bearer ${tokenEl.value.trim()}`, "content-type": "application/json" };
}
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: headers() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}
function say(text) {
  const p = document.createElement("p");
  p.textContent = text;
  thread.append(p);
}
async function refresh() {
  const vow = encodeURIComponent(vowEl.value.trim());
  const status = await api(`/api/status?vow=${vow}`);
  summary.textContent = `${status.mock_label} · ${status.decision.state} · done ${status.summary.done} · streak ${status.summary.streak}`;
  const audit = await api("/api/audit");
  chain.replaceChildren();
  const li = document.createElement("li");
  li.textContent = `${audit.decision.lead} (${audit.count} check-ins)`;
  chain.append(li);
}

document.querySelector("#chat-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const chat = await api(`/api/chat?vow=${encodeURIComponent(vowEl.value.trim())}`, { method: "POST", body: "{}" });
    say(`Canned companion (${chat.provider}, not a real LLM): ${chat.text}`);
    await refresh();
  } catch (err) { summary.textContent = err.message; }
});
document.querySelector("#vow-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const out = await api("/api/vow", { method: "POST", body: JSON.stringify({ vow_id: vowEl.value.trim(), title: document.querySelector("#title").value, cadence: "daily" }) });
    say(`Vow stored as mock receipt ${out.receipt.blob_id}. durable=${out.durable}`);
  } catch (err) { summary.textContent = err.message; }
});
document.querySelector("#checkin-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const out = await api("/api/checkin", { method: "POST", body: JSON.stringify({ vow_id: vowEl.value.trim(), date: document.querySelector("#date").value, status: document.querySelector("#status").value, note: document.querySelector("#note").value }) });
    say(`Check-in ${out.entry.checkin_id} seq ${out.entry.seq}`);
    await refresh();
  } catch (err) { summary.textContent = err.message; }
});
document.querySelector("#fix-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const out = await api("/api/correction", { method: "POST", body: JSON.stringify({ vow_id: vowEl.value.trim(), date: document.querySelector("#date").value, status: "done", supersedes: document.querySelector("#supersedes").value, note: "appended correction" }) });
    say(`Correction appended as ${out.entry.checkin_id}, not edited in place`);
    await refresh();
  } catch (err) { summary.textContent = err.message; }
});
