// Slack delivery adapter (proactive DM reminders). externalId = the DM channel id captured at /link time.
// Buttons: Block Kit actions, action_id = "<occurrenceId>:<reply>" (same shape as Telegram/Discord; handled by slack-webhook handleInteraction).
export function createSlackAdapter({ token, channelId, fetchFn = globalThis.fetch }) {
  if (!token || !channelId) throw new TypeError('slack: token and channelId required');
  return {
    id: 'slack', supportsButtons: true,
    presence() { return { state: 'unknown' }; },
    async send(msg) {
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: msg.text } }];
      if (msg.buttons?.length) blocks.push({ type: 'actions', elements: msg.buttons.slice(0, 5).map((b) => ({ type: 'button', text: { type: 'plain_text', text: b.label }, action_id: `${msg.occurrenceId}:${b.id}`, value: `${msg.occurrenceId}:${b.id}` })) });
      const r = await fetchFn('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ channel: channelId, text: msg.text, blocks }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(`slack chat.postMessage failed: ${j.error ?? r.status}`); // slack returns 200 with ok:false
      return j;
    },
  };
}
