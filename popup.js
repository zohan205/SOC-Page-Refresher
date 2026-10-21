/**
 * SOC Page Refresh & Keyword Monitor - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const valCountdown = document.getElementById('valCountdown');
  const valRefreshes = document.getElementById('valRefreshes');
  const valMatches = document.getElementById('valMatches');

  const inputInterval = document.getElementById('inputInterval');
  const selectRunMode = document.getElementById('selectRunMode');
  const rowFiniteCount = document.getElementById('rowFiniteCount');
  const inputFiniteCount = document.getElementById('inputFiniteCount');

  const inputKeyword = document.getElementById('inputKeyword');
  const chkEnableKeyword = document.getElementById('chkEnableKeyword');
  const chkNotifyUser = document.getElementById('chkNotifyUser');
  const chkCaseSensitive = document.getElementById('chkCaseSensitive');
  const chkDomScope = document.getElementById('chkDomScope');

  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const errorNotice = document.getElementById('errorNotice');

  let activeTabId = null;
  let countdownTimer = null;

  selectRunMode.addEventListener('change', () => {
    rowFiniteCount.style.display = selectRunMode.value === 'finite' ? 'flex' : 'none';
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showError('Unable to identify active tab.');
      btnStart.disabled = true;
      return;
    }

    activeTabId = tab.id;

    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      showError('Monitor only runs on standard web pages (HTTP/HTTPS).');
      btnStart.disabled = true;
      return;
    }

    chrome.runtime.sendMessage({ action: 'GET_SESSION', tabId: activeTabId }, (session) => {
      if (!chrome.runtime.lastError && session) {
        applySessionToUI(session);
      }
    });

  } catch (err) {
    showError('Error initializing extension: ' + err.message);
    return;
  }

  function applySessionToUI(session) {
    if (session.intervalSeconds) inputInterval.value = session.intervalSeconds;
    if (session.runMode) {
      selectRunMode.value = session.runMode;
      rowFiniteCount.style.display = session.runMode === 'finite' ? 'flex' : 'none';
    }
    if (session.finiteCount) inputFiniteCount.value = session.finiteCount;

    if (session.keywordConfig) {
      inputKeyword.value = session.keywordConfig.keyword || '';
      chkEnableKeyword.checked = Boolean(session.keywordConfig.enabled);
      chkNotifyUser.checked = Boolean(session.keywordConfig.notifyUser);
      chkCaseSensitive.checked = Boolean(session.keywordConfig.caseSensitive);
      chkDomScope.checked = session.keywordConfig.scope === 'html';
    }

    valRefreshes.textContent = session.completedRefreshes || 0;
    valMatches.textContent = session.lastMatchCount || 0;

    if (session.running) {
      setUIRunning(true);
      startCountdownWatcher(session.nextRefreshTimestamp);
    } else {
      setUIRunning(false);
    }
  }

  function setUIRunning(isRunning) {
    if (isRunning) {
      statusBadge.className = 'status-indicator status-running';
      statusText.textContent = 'RUNNING';
      btnStart.disabled = true;
      btnStop.disabled = false;
      inputInterval.disabled = true;
      selectRunMode.disabled = true;
      inputFiniteCount.disabled = true;
    } else {
      statusBadge.className = 'status-indicator status-idle';
      statusText.textContent = 'IDLE';
      btnStart.disabled = false;
      btnStop.disabled = true;
      inputInterval.disabled = false;
      selectRunMode.disabled = false;
      inputFiniteCount.disabled = false;
      valCountdown.textContent = '--';
      if (countdownTimer) clearInterval(countdownTimer);
    }
  }

  function startCountdownWatcher(nextRefreshTimestamp) {
    if (countdownTimer) clearInterval(countdownTimer);

    const update = () => {
      const remainingMs = Math.max(0, nextRefreshTimestamp - Date.now());
      const sec = Math.ceil(remainingMs / 1000);
      valCountdown.textContent = sec < 100 ? String(sec).padStart(2, '0') : String(sec);

      if (remainingMs <= 0) {
        clearInterval(countdownTimer);
      }
    };

    update();
    countdownTimer = setInterval(update, 500);
  }

  btnStart.addEventListener('click', () => {
    hideError();

    const interval = parseInt(inputInterval.value, 10);
    if (isNaN(interval) || interval < 5) {
      showError('Minimum interval is 5 seconds.');
      return;
    }

    const runMode = selectRunMode.value;
    const finiteCount = parseInt(inputFiniteCount.value, 10);
    if (runMode === 'finite' && (isNaN(finiteCount) || finiteCount < 1)) {
      showError('Please set a valid max refresh count.');
      return;
    }

    const payload = {
      tabId: activeTabId,
      intervalSeconds: interval,
      runMode,
      finiteCount: runMode === 'finite' ? finiteCount : 0,
      keywordConfig: {
        enabled: chkEnableKeyword.checked,
        keyword: inputKeyword.value,
        notifyUser: chkNotifyUser.checked,
        caseSensitive: chkCaseSensitive.checked,
        scope: chkDomScope.checked ? 'html' : 'text'
      }
    };

    btnStart.disabled = true;

    chrome.runtime.sendMessage({ action: 'START_SESSION', payload }, (res) => {
      if (chrome.runtime.lastError) {
        showError('Service worker communication error. Reload the extension.');
        btnStart.disabled = false;
        return;
      }

      if (res && res.success) {
        setUIRunning(true);
        startCountdownWatcher(res.session.nextRefreshTimestamp);
      } else {
        btnStart.disabled = false;
        showError('Could not start session.');
      }
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP_SESSION', payload: { tabId: activeTabId } }, () => {
      setUIRunning(false);
    });
  });

  function showError(msg) {
    errorNotice.textContent = msg;
    errorNotice.style.display = 'block';
  }

  function hideError() {
    errorNotice.textContent = '';
    errorNotice.style.display = 'none';
  }
});