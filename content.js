/**
 * SOC Page Refresh & Keyword Monitor - Content Script
 */

(function initContentScanner() {
  const OVERLAY_HOST_ID = '__soc_monitor_overlay_host';

  chrome.runtime.sendMessage({ action: 'GET_SESSION' }, (session) => {
    if (chrome.runtime.lastError || !session || !session.keywordConfig) return;

    const config = session.keywordConfig;
    if (!config.enabled || !config.keyword || !config.keyword.trim()) return;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      executeScan(config, session.tabId);
    } else {
      window.addEventListener('DOMContentLoaded', () => executeScan(config, session.tabId), { once: true });
    }
  });

  function executeScan(config, tabId) {
    // 1. Remove previous overlay so it is never included in the count
    const existingHost = document.getElementById(OVERLAY_HOST_ID);
    if (existingHost) existingHost.remove();

    // 2. Extract content based on scope
    const sourceContent = config.scope === 'html'
      ? (document.documentElement ? document.documentElement.outerHTML : '')
      : (document.body ? document.body.innerText : '');

    // 3. Count exact matches
    const matchesCount = countOccurrences(sourceContent, config.keyword, config.caseSensitive);

    // 4. Update the Tab Title so you can see it in the tab strip even from another tab!
    if (matchesCount > 0) {
      const cleanTitle = document.title.replace(/^\[\d+ MATCH(ES)?\]\s*/i, '');
      document.title = `[${matchesCount} MATCH${matchesCount > 1 ? 'ES' : ''}] ${cleanTitle}`;
    }

    // 5. Send results to the Service Worker
    chrome.runtime.sendMessage({
      action: 'KEYWORD_MATCH_FOUND',
      payload: {
        tabId: tabId,
        keyword: config.keyword,
        count: matchesCount,
        notifyUser: config.notifyUser
      }
    });

    // 6. Show the in-page translucent banner
    if (matchesCount > 0) {
      mountShadowNotification(config.keyword, matchesCount);
    }
  }

  function countOccurrences(text, searchStr, caseSensitive) {
    if (!text || !searchStr) return 0;
    let target = caseSensitive ? searchStr : searchStr.toLowerCase();
    let pool = caseSensitive ? text : text.toLowerCase();

    let count = 0;
    let pos = 0;
    const step = target.length;

    while ((pos = pool.indexOf(target, pos)) !== -1) {
      count++;
      pos += step;
    }
    return count;
  }

  function mountShadowNotification(keyword, count) {
    const host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.left = '24px';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({ mode: 'closed' });
    const banner = document.createElement('div');
    banner.className = 'soc-alert-banner';
    const plural = count === 1 ? 'time' : 'times';

    banner.innerHTML = `
      <style>
        .soc-alert-banner {
          background-color: rgba(7, 11, 20, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid #00f0ff;
          border-radius: 8px;
          box-shadow: 0 8px 30px rgba(0, 240, 255, 0.25);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
          font-size: 13px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }
        .soc-icon { color: #00f0ff; font-size: 18px; }
        .highlight { color: #00f0ff; font-weight: 700; }
        .sub-hint { display: block; font-size: 10px; color: #94a3b8; margin-top: 2px; }
      </style>
      <div class="soc-icon">⛨</div>
      <div>
        <span>"${escapeHtml(keyword)}" found on this webpage <span class="highlight">${count}</span> ${plural}</span>
        <span class="sub-hint">(Click anywhere or press Esc to dismiss)</span>
      </div>
    `;

    shadow.appendChild(banner);
    document.documentElement.appendChild(host);

    function cleanup() {
      if (host && host.parentNode) host.remove();
      document.removeEventListener('click', cleanup, true);
      document.removeEventListener('keydown', handleKey, true);
    }
    function handleKey(e) {
      if (e.key === 'Escape') cleanup();
    }

    setTimeout(() => {
      document.addEventListener('click', cleanup, { capture: true, once: true });
      document.addEventListener('keydown', handleKey, { capture: true });
    }, 150);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  }
})();