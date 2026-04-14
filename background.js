let ordersCache = [];
let captureStatus = { inProgress: false, message: '', count: 0, done: false };
let trackingEnabled = true;

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
  loadCache();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel) {
    try {
      await chrome.sidePanel.open({ tab });
    } catch (e) {
      console.log('Side panel API error:', e);
    }
  }
});

function loadCache() {
  chrome.storage.local.get(['orders', 'settings'], (data) => {
    ordersCache = data.orders || [];
    trackingEnabled = data.settings?.trackingEnabled !== false;
    console.log('Cache loaded with', ordersCache.length, 'orders, tracking:', trackingEnabled);
  });
}

function saveCache() {
  chrome.storage.local.set({ orders: ordersCache }, () => {
    console.log('Cache saved with', ordersCache.length, 'orders');
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ORDER_DATA') {
    if (!trackingEnabled) {
      sendResponse({ success: false, reason: 'Tracking disabled' });
      return true;
    }
    
    const existingIndex = ordersCache.findIndex(o => o.orderId === message.order.orderId);
    
    if (existingIndex === -1) {
      ordersCache.unshift(message.order);
      console.log('Added order', message.order.orderId, '- total:', ordersCache.length);
    } else {
      ordersCache[existingIndex] = { ...ordersCache[existingIndex], ...message.order };
      console.log('Updated order', message.order.orderId, 'with enriched data');
    }
    
    saveCache();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'CAPTURE_PROGRESS') {
    captureStatus = { inProgress: true, message: message.message || 'Processing...', count: 0, done: false };
    return false;
  }
  
  if (message.type === 'CAPTURE_DONE') {
    captureStatus = { inProgress: false, message: 'Done!', count: ordersCache.length, done: true };
    return false;
  }
  
  if (message.type === 'GET_DATA') {
    chrome.storage.local.get(['orders', 'settings'], (data) => {
      ordersCache = data.orders || [];
      trackingEnabled = data.settings?.trackingEnabled !== false;
      sendResponse({ orders: ordersCache, settings: data.settings || {}, captureStatus });
    });
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }, () => {
      if (message.settings.trackingEnabled !== undefined) {
        trackingEnabled = message.settings.trackingEnabled;
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'SET_TRACKING') {
    trackingEnabled = message.enabled;
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || {};
      settings.trackingEnabled = trackingEnabled;
      chrome.storage.local.set({ settings });
    });
    console.log('Tracking:', trackingEnabled ? 'enabled' : 'disabled');
    return false;
  }
  
  if (message.type === 'RESTORE_DATA') {
    ordersCache = message.data.orders || [];
    saveCache();
    if (message.data.settings) {
      chrome.storage.local.get(['settings'], (data) => {
        const settings = { ...data.settings, ...message.data.settings };
        chrome.storage.local.set({ settings });
      });
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'CLEAR_DATA') {
    ordersCache = [];
    chrome.storage.local.set({ orders: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'SAVE_ORDERS') {
    ordersCache = message.orders || [];
    chrome.storage.local.set({ orders: ordersCache }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_TRACKING_STATE') {
    sendResponse(trackingEnabled);
    return true;
  }
});