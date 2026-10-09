import { remember } from './lib.js';

chrome.runtime.onInstalled.addListener(() =>
  chrome.contextMenus.create({ id: 'vow-remember', title: 'Remember in Vow', contexts: ['selection'] }));

const note = (message) => chrome.notifications.create({ type: 'basic', iconUrl: 'icons/128.png', title: 'Vow', message });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'vow-remember' || !info.selectionText) return;
  try {
    const text = `${info.selectionText.trim().slice(0, 500)} (${new URL(tab.url).hostname})`;
    await remember(text);
    note('Saved to your Vow memory.');
  } catch (e) { note(e.message); }
});
