/**
 * SOC Page Refresh & Keyword Monitor - Service Worker (Manifest V3)
 */

const BADGE_COLOR_COUNTDOWN = '#06b6d4';
const BADGE_COLOR_MATCH = '#ec4899';
const BADGE_COLOR_IDLE = '#475569';
const NOTIFICATION_ID = 'soc_active_alert'; // Static ID prevents notification stacking

let notificationDismissTimer = null;

async function getTabSession(tabId) {
  if (!tabId) return null;
  const key = `session_${tabId}`;
  const res = await chrome.storage.local.get(key);
  return res[key] || null;
}

async function saveTabSession(tabId, sessionData) {
  const key = `session_${tabId}`;
  await chrome.storage.local.set({ [key]: sessionData });
}

async function removeTabSession(tabId) {
  const key = `session_${tabId}`;
  await chrome.storage.local.remove(key);
  try {
    await chrome.alarms.clear(`alarm_${tabId}`);
  } catch (e) {}
  await clearBadge(tabId);
}

// Ensure only one tab session can run at any given time
async function stopAllOtherSessions(currentTabId) {
  const allData = await chrome.storage.local.get(null);
  for (const [key, session] of Object.entries(allData)) {
    if (key.startsWith('session_') && session && session.tabId !== currentTabId) {
      await removeTabSession(session.tabId);
    }
  }
}

async function setBadgeText(tabId, text, bgColor) {
  try {
    await chrome.action.setBadgeText({ tabId, text: String(text) });
    if (bgColor) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: bgColor });
    }
  } catch (err) {}
}

async function clearBadge(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId, text: '' });
  } catch (err) {}
}

let countdownTicker = null;

function ensureTickerRunning() {
  if (countdownTicker) return;
  countdownTicker = setInterval(updateActiveCountdowns, 1000);
}

async function updateActiveCountdowns() {
  const allData = await chrome.storage.local.get(null);
  const now = Date.now();
  let hasRunningSessions = false;

  for (const [key, session] of Object.entries(allData)) {
    if (!key.startsWith('session_') || !session || !session.running) continue;

    hasRunningSessions = true;
    const tabId = session.tabId;
    const remainingMs = Math.max(0, session.nextRefreshTimestamp - now);
    const remainingSec = Math.ceil(remainingMs / 1000);

    const displaySec = remainingSec < 100 ? String(remainingSec).padStart(2, '0') : '99';

    if (session.lastMatchCount > 0 && remainingSec === 0) {
      await setBadgeText(tabId, `${session.lastMatchCount}F`, BADGE_COLOR_MATCH);
    } else {
      await setBadgeText(tabId, displaySec, BADGE_COLOR_COUNTDOWN);
    }
  }

  if (!hasRunningSessions && countdownTicker) {
    clearInterval(countdownTicker);
    countdownTicker = null;
  }
}

// Alarm Listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('alarm_')) return;
  const tabId = parseInt(alarm.name.replace('alarm_', ''), 10);
  const session = await getTabSession(tabId);

  if (!session || !session.running) return;

  if (session.runMode === 'finite' && session.completedRefreshes >= session.finiteCount) {
    session.running = false;
    await saveTabSession(tabId, session);
    await chrome.alarms.clear(alarm.name);
    await setBadgeText(tabId, 'DONE', BADGE_COLOR_IDLE);
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      await removeTabSession(tabId);
      return;
    }

    session.completedRefreshes += 1;
    session.nextRefreshTimestamp = Date.now() + (session.intervalSeconds * 1000);
    await saveTabSession(tabId, session);

    chrome.alarms.create(`alarm_${tabId}`, {
      when: session.nextRefreshTimestamp
    });

    await chrome.tabs.reload(tabId, { bypassCache: false });
  } catch (err) {
    await removeTabSession(tabId);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const session = await getTabSession(activeInfo.tabId);
  if (!session) {
    await clearBadge(activeInfo.tabId);
    return;
  }

  if (session.running) {
    const remainingSec = Math.max(0, Math.ceil((session.nextRefreshTimestamp - Date.now()) / 1000));
    const formatted = remainingSec < 100 ? String(remainingSec).padStart(2, '0') : '99';
    await setBadgeText(activeInfo.tabId, formatted, BADGE_COLOR_COUNTDOWN);
  } else if (session.lastMatchCount > 0) {
    await setBadgeText(activeInfo.tabId, `${session.lastMatchCount}F`, BADGE_COLOR_MATCH);
  } else {
    await clearBadge(activeInfo.tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabSession(tabId);
});

// Central Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_SESSION') {
    const resolvedTabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : message.tabId;
    getTabSession(resolvedTabId)
      .then((session) => sendResponse(session))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message.action === 'START_SESSION') {
    handleStartSession(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'STOP_SESSION') {
    handleStopSession(message.payload.tabId)
      .then((res) => sendResponse(res))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.action === 'KEYWORD_MATCH_FOUND') {
    const tabId = (sender && sender.tab && sender.tab.id) ? sender.tab.id : message.payload.tabId;
    handleKeywordMatch(tabId, message.payload, sender)
      .then((res) => sendResponse(res))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
});

async function handleStartSession(payload) {
  const { tabId, intervalSeconds, runMode, finiteCount, keywordConfig } = payload;
  
  // Requirement 2: Terminate any existing sessions so only ONE tab runs at any time
  await stopAllOtherSessions(tabId);

  const nextRefresh = Date.now() + (intervalSeconds * 1000);

  const session = {
    tabId,
    running: true,
    intervalSeconds,
    runMode,
    finiteCount: runMode === 'finite' ? finiteCount : 0,
    completedRefreshes: 0,
    nextRefreshTimestamp: nextRefresh,
    keywordConfig,
    lastMatchCount: 0,
    lastScanTimestamp: null
  };

  await saveTabSession(tabId, session);

  chrome.alarms.create(`alarm_${tabId}`, {
    when: nextRefresh
  });

  ensureTickerRunning();
  await setBadgeText(tabId, String(intervalSeconds).padStart(2, '0'), BADGE_COLOR_COUNTDOWN);
  return { success: true, session };
}

async function handleStopSession(tabId) {
  const session = await getTabSession(tabId);
  if (session) {
    session.running = false;
    await saveTabSession(tabId, session);
  }
  try {
    await chrome.alarms.clear(`alarm_${tabId}`);
  } catch (e) {}
  await clearBadge(tabId);
  return { success: true };
}

async function handleKeywordMatch(tabId, payload, sender) {
  if (!tabId) return { success: false };

  const session = await getTabSession(tabId);
  if (session) {
    session.lastMatchCount = payload.count;
    session.lastScanTimestamp = Date.now();
    await saveTabSession(tabId, session);
  }

  if (payload.count > 0) {
    await setBadgeText(tabId, `${payload.count}F`, BADGE_COLOR_MATCH);

    if (payload.notifyUser) {
      // Requirement 1: Only notify if the monitored tab is NOT currently visible/focused
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const lastFocusedWin = await chrome.windows.getLastFocused();
      const isCurrentlyViewingTab = activeTab && activeTab.id === tabId && lastFocusedWin && lastFocusedWin.focused;

      if (!isCurrentlyViewingTab) {
        const rawTitle = (sender && sender.tab && sender.tab.title) ? sender.tab.title : 'Target Webpage';
        const cleanTitle = rawTitle.replace(/^\[\d+\s+MATCH(ES)?\]\s*/i, '');

        // Requirement 3: Clear existing notification first so toasts never stack
        chrome.notifications.clear(NOTIFICATION_ID);
        if (notificationDismissTimer) clearTimeout(notificationDismissTimer);

        chrome.notifications.create(NOTIFICATION_ID, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: `Match Alert: ${payload.count} Found`,
          message: `Found "${payload.keyword}" on: ${cleanTitle}`,
          priority: 2,
          requireInteraction: false
        });

        // Requirement 3: Automatically dismiss after exactly 3 seconds
        notificationDismissTimer = setTimeout(() => {
          chrome.notifications.clear(NOTIFICATION_ID);
        }, 3000);
      }
    }
  }

  return { success: true };
}