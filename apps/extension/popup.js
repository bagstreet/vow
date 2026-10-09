import { getSettings, saveSettings, whoami, recall, remember } from './lib.js';
const $ = (id) => document.getElementById(id);
const msg = (t) => { $('msg').textContent = t; };
const run = async (fn) => { try { await fn(); } catch (e) { msg(e.message); } };

(async () => {
  const s = await getSettings();
  $('base').value = s.base; $('token').value = s.token; $('role').value = s.role;
  if (!s.token) $('cfg').open = true;
  else run(async () => { const me = await whoami(); $('who').textContent = me.label; if (!s.role && me.roles?.[0]) { $('role').value = me.roles[0]; await saveSettings({ role: me.roles[0] }); } });
})();

$('store').onclick = () => run(async () => { await saveSettings({ base: $('base').value.trim(), token: $('token').value.trim(), role: $('role').value.trim() }); msg('Settings saved.'); });
$('save').onclick = () => run(async () => { const t = $('text').value.trim(); if (!t) return; await remember(t); $('text').value = ''; msg('Saved to your Vow memory.'); });
$('find').onclick = () => run(async () => {
  const r = await recall($('q').value.trim()); $('out').replaceChildren();
  for (const x of r.results ?? []) { const li = document.createElement('li'); li.textContent = x.text ?? String(x); $('out').append(li); }
  msg((r.results ?? []).length ? '' : 'Nothing found.');
});
