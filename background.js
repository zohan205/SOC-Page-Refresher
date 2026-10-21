chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("refresh_")) {
    const tabId = parseInt(alarm.name.split("_")[1]);
    const key = `refresh_${tabId}`;
    
    const data = await chrome.storage.local.get(key);
    const config = data[key];
    if (!config) return;

    config.currentRun++;
    
    // Check if finite limits have been crossed
    if (config.mode === 'finite' && config.currentRun > config.maxRuns) {
      chrome.alarms.clear(alarm.name);
      chrome.storage.local.remove(key);
      return;
    }

    // Save updated run counters
    await chrome.storage.local.set({ [key]: config });

    try {
      // Reload tab safely
      chrome.tabs.reload(tabId, { bypassCache: false }, () => {
        if (chrome.runtime.lastError) {
          // Tab closed or detached, clean up worker footprint
          chrome.alarms.clear(alarm.name);
          chrome.storage.local.remove(key);
        }
      });
    } catch (e) {
      chrome.alarms.clear(alarm.name);
    }
  }
});

// Run script injection after page finishes loading
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const key = `refresh_${tabId}`;
    const data = await chrome.storage.local.get(key);
    const config = data[key];
    
    if (config && config.keyword) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: searchAndNotifyOnPage,
        args: [config.keyword]
      }).catch(err => console.log("Script injection skipped (restricted system tab)."));
    }
  }
});

// Listen to UI panel messages
chrome.runtime.sendMessage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const alarmName = `refresh_${request.tabId}`;
  if (request.action === "start") {
    chrome.alarms.create(alarmName, { periodInMinutes: request.interval / 60 });
  } else if (request.action === "stop") {
    chrome.alarms.clear(alarmName);
    chrome.storage.local.remove(alarmName);
  }
});

// Content execution ecosystem
function searchAndNotifyOnPage(keyword) {
  // Case-insensitive textual scanning directly across the visible layout text
  const bodyText = document.body.innerText || "";
  const regex = new RegExp(keyword.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&'), 'gi');
  const matches = bodyText.match(regex);
  const count = matches ? matches.length : 0;

  if (count > 0) {
    // Remove conflicting overlays if present
    const oldNotify = document.getElementById('refresh-notifier-overlay');
    if (oldNotify) oldNotify.remove();

    const notificationBox = document.createElement('div');
    notificationBox.id = 'refresh-notifier-overlay';
    
    // Low-overhead element stylings
    Object.assign(notificationBox.style, {
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      padding: '12px 18px',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      borderRadius: '8px',
      zIndex: '2147483647',
      pointerEvents: 'none', 
      backdropFilter: 'blur(4px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'opacity 0.25s ease'
    });

    notificationBox.innerText = `"${keyword}" found on this webpage ${count} time${count > 1 ? 's' : ''}`;
    document.documentElement.appendChild(notificationBox);

    // Global body event listener: disappears cleanly when clicking anywhere on the webpage
    const dismissNotification = () => {
      notificationBox.style.opacity = '0';
      setTimeout(() => notificationBox.remove(), 250);
      document.removeEventListener('click', dismissNotification);
    };
    // Defer execution slightly to prevent immediate self-dismissal from the installation click
    setTimeout(() => {
      document.addEventListener('click', dismissNotification);
    }, 100);
  }
}
