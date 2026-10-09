# Vow browser extension

Select text on any page, right-click **Remember in Vow**, and it is saved as a verified fact to your Walrus-backed memory through the [Agent API](../../docs/API.md). The popup lets you save a note and recall what Vow knows.

1. Chrome: `chrome://extensions` > Developer mode > **Load unpacked** > pick this folder.
2. In the Vow dashboard create an agent token, open the extension popup, paste the token and a role you allowed for it.

The token stays in `chrome.storage.local`. Only the text you select is sent, and only when you ask.

Notes: the extension does not show reminder notifications yet; it saves selected text and recalls memory. Reminders arrive in your chat channels.
