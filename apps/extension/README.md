# Vow browser extension

A delivery channel, like Telegram or Slack. Vow reminders arrive as browser notifications with the same quick-reply buttons (Taken, Skip, Later), and the popup lists everything still waiting. Answering here marks the reminder handled in every other channel.

## Install and connect

1. Chrome: `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick this folder.
2. Vow dashboard: **Channels**, **Browser extension**, **Connect**. A pairing code appears (valid 10 minutes, one use).
3. Open the extension popup, enter the code, press **Connect**.
4. Press **Test notification** to confirm your browser allows notifications.

The extension appears in **Where Vow reaches you first**, so you can rank it against the other channels. One browser is paired per account; pairing again replaces the old one.

## How it works

The extension polls `/api/ext` once a minute (Chrome alarms), so it works only while the browser is running. If you do not answer within the escalation wait, Vow moves on to your next channel. The pairing secret is stored in `chrome.storage.local`, and only its hash is stored on the server. Mute for an hour, until tomorrow, or until you switch it back on; muted reminders wait in the popup.

Self-hosted? Open **Self-hosted?** in the popup and enter your server URL.
