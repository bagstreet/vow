// Speech-to-text via Groq Whisper (free tier). Input: base64 audio from the browser MediaRecorder.
export async function transcribeAudio(b64, mime = 'audio/webm', { key = process.env.GROQ_API_KEY, fetchFn = globalThis.fetch } = {}) {
  if (!key) throw new Error('no_stt_key');
  const buf = Buffer.from(b64, 'base64');
  const ext = /mp4|m4a/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), `voice.${ext}`);
  fd.append('model', 'whisper-large-v3-turbo');
  fd.append('response_format', 'json');
  const r = await fetchFn('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`stt_${r.status}`);
  return String(j.text ?? '').trim();
}
