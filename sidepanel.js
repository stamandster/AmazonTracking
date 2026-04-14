(function() {
  const elements = {
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    yearMultiSelect: document.getElementById('yearMultiSelect'),
    cardMultiSelect: document.getElementById('cardMultiSelect'),
    payerMultiSelect: document.getElementById('payerMultiSelect'),
    showReturns: document.getElementById('showReturns'),
    ordersContainer: document.getElementById('ordersContainer'),
    ordersList: document.getElementById('ordersList'),
    emptyState: document.getElementById('emptyState'),
    totalItems: document.getElementById('totalItems'),
    totalSpent: document.getElementById('totalSpent'),
    totalOrders: document.getElementById('totalOrders'),
    exportBtn: document.getElementById('exportBtn'),
    exportScope: document.getElementById('exportScope'),
    backupBtn: document.getElementById('backupBtn'),
    restoreBtn: document.getElementById('restoreBtn'),
    restoreInput: document.getElementById('restoreInput'),
    clearBtn: document.getElementById('clearBtn'),
    toast: document.getElementById('toast'),
    clearModal: document.getElementById('clearModal'),
    closeClearModal: document.getElementById('closeClearModal'),
    cancelClear: document.getElementById('cancelClear'),
    confirmClear: document.getElementById('confirmClear'),
    captureNotification: document.getElementById('captureNotification'),
    captureMessage: document.getElementById('captureMessage'),
    trackingToggle: document.getElementById('trackingToggle'),
    expandAll: document.getElementById('expandAll'),
    collapseAll: document.getElementById('collapseAll'),
    clearIgnored: document.getElementById('clearIgnored')
  };
  
  let state = {
    orders: [],
    settings: { trackingEnabled: true },
    searchQuery: '',
    yearFilter: [],
    cardFilter: [],
    payerFilter: [],
    showReturns: true,
    captureStatus: { inProgress: false, message: '', done: false },
    notifiedDone: false,
    queueLength: 0,
    expandedOrders: new Set()
  };
  
  function loadData() {
    chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
      console.log('Side panel loaded orders:', (data.orders || []).length);
      state.orders = data.orders || [];
      state.settings = data.settings || { trackingEnabled: true };
      state.yearFilter = [];
      state.cardFilter = [];
      state.payerFilter = [];
      updateTrackingToggle();
      updateFilters();
      render();
      if (data.captureStatus) {
        updateCaptureNotification(data.captureStatus);
      }
    });
  }
  
  function updateTrackingToggle() {
    const enabled = state.settings.trackingEnabled !== false;
    elements.trackingToggle.textContent = enabled ? 'Stop Tracking' : 'Start Tracking';
    elements.trackingToggle.className = 'btn-toggle ' + (enabled ? 'tracking' : 'stopped');
  }
  
  function toggleTracking() {
    const newState = state.settings.trackingEnabled !== false;
    state.settings.trackingEnabled = !newState;
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_SETTINGS', 
      settings: state.settings 
    });
    chrome.runtime.sendMessage({ 
      type: 'SET_TRACKING', 
      enabled: state.settings.trackingEnabled 
    });
    updateTrackingToggle();
    showToast(state.settings.trackingEnabled ? 'Tracking enabled' : 'Tracking paused');
  }
  
  function updateFilters() {
    const years = [...new Set(state.orders.map(o => extractYear(o.date)))].filter(y => y).sort().reverse();
    const cards = [...new Set(state.orders.map(o => o.cardEnding).filter(c => c))].sort();
    const payers = [...new Set(state.orders.map(o => o.payer))].filter(p => p && p !== 'N/A - Transaction').sort();
    
    populateMultiSelect(elements.yearMultiSelect, years, state.yearFilter);
    populateMultiSelect(elements.cardMultiSelect, cards.map(c => ({ value: c, label: '****' + c })), state.cardFilter);
    populateMultiSelect(elements.payerMultiSelect, payers, state.payerFilter);
  }
  
  function populateMultiSelect(multiSelectEl, options, selectedValues) {
    const isAllOption = Array.isArray(options) && options.length > 0 && options[0] === 'all';
    
    if (isAllOption) {
      options = [];
    }
    
    const dropdown = multiSelectEl.querySelector('.multi-select-dropdown');
    const valueSpan = multiSelectEl.querySelector('.multi-select-value');
    
    dropdown.innerHTML = '';
    
    const allOption = document.createElement('label');
    allOption.className = 'multi-select-option';
    allOption.innerHTML = `<input type="checkbox" value="all" ${selectedValues.length === 0 || selectedValues.includes('all') ? 'checked' : ''}><span>All</span>`;
    dropdown.appendChild(allOption);
    
    if (options.length > 0) {
      const divider = document.createElement('div');
      divider.style.borderBottom = '1px solid var(--border)';
      divider.style.margin = '4px 0';
      dropdown.appendChild(divider);
    }
    
    options.forEach(opt => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const label = typeof opt === 'object' ? opt.label : opt;
      const labelEl = document.createElement('label');
      labelEl.className = 'multi-select-option';
      labelEl.innerHTML = `<input type="checkbox" value="${escapeHtml(value)}" ${selectedValues.includes(value) ? 'checked' : ''}><span>${escapeHtml(label)}</span>`;
      dropdown.appendChild(labelEl);
    });
    
    updateMultiSelectValue(multiSelectEl, selectedValues);
  }
  
  function updateMultiSelectValue(multiSelectEl, selectedValues) {
    const valueSpan = multiSelectEl.querySelector('.multi-select-value');
    const allCheckbox = multiSelectEl.querySelector(`input[value="all"]`);
    
    if (selectedValues.length === 0 || (allCheckbox && allCheckbox.checked)) {
      valueSpan.textContent = 'All';
    } else {
      const checkedOptions = selectedValues.filter(v => v !== 'all');
      if (checkedOptions.length <= 2) {
        valueSpan.textContent = checkedOptions.join(', ');
      } else {
        valueSpan.textContent = checkedOptions.length + ' selected';
      }
    }
  }
  
  function getSelectedValues(multiSelectEl) {
    const checkboxes = multiSelectEl.querySelectorAll('input[type="checkbox"]:checked');
    const values = Array.from(checkboxes).map(cb => cb.value);
    if (values.includes('all')) return [];
    return values;
  }
  
  function initMultiSelectHandlers() {
    document.querySelectorAll('.multi-select').forEach(multiSelect => {
      const trigger = multiSelect.querySelector('.multi-select-trigger');
      
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.multi-select.open').forEach(el => {
          if (el !== multiSelect) el.classList.remove('open');
        });
        multiSelect.classList.toggle('open');
      });
    });
    
    document.addEventListener('change', (e) => {
      if (!e.target.matches('.multi-select-dropdown input[type="checkbox"]')) return;
      
      const checkbox = e.target;
      const dropdown = checkbox.closest('.multi-select-dropdown');
      const multiSelect = dropdown.closest('.multi-select');
      const multiSelectId = multiSelect.id;
      
      const allCheckbox = dropdown.querySelector('input[value="all"]');
      const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      
      if (checkbox.value === 'all') {
        if (checkbox.checked) {
          checkboxes.forEach(cb => {
            if (cb.value !== 'all') cb.checked = false;
          });
        }
      } else {
        if (allCheckbox) allCheckbox.checked = false;
      }
      
      const selected = getSelectedValues(multiSelect);
      
      if (multiSelectId === 'yearMultiSelect') {
        state.yearFilter = selected;
      } else if (multiSelectId === 'cardMultiSelect') {
        state.cardFilter = selected;
      } else if (multiSelectId === 'payerMultiSelect') {
        state.payerFilter = selected;
      }
      
      updateMultiSelectValue(multiSelect, selected);
      render();
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.multi-select')) {
        document.querySelectorAll('.multi-select.open').forEach(el => el.classList.remove('open'));
      }
    });
  }
  
  function extractYear(dateStr) {
    const match = dateStr.match(/\d{4}/);
    return match ? match[0] : null;
  }
  
  function parsePrice(priceStr) {
    const match = (priceStr || '').match(/[+-]?[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '').replace(/[+-]/g, '')) : 0;
  }
  
  function formatPrice(price) {
    const prefix = price < 0 ? '-$' : '$';
    return prefix + Math.abs(price).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }
  
  function getFilteredOrders() {
    let filtered = state.orders;
    
    if (!state.showReturns) {
      filtered = filtered.filter(o => !o.isFullyReturned);
    }
    
    if (state.yearFilter.length > 0) {
      filtered = filtered.filter(o => state.yearFilter.includes(extractYear(o.date)));
    }
    
    if (state.cardFilter.length > 0) {
      filtered = filtered.filter(o => state.cardFilter.includes(o.cardEnding));
    }
    
    if (state.payerFilter.length > 0) {
      filtered = filtered.filter(o => state.payerFilter.includes(o.payer));
    }
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(o => {
        if (o.orderId.toLowerCase().includes(query)) return true;
        if (o.payer.toLowerCase().includes(query)) return true;
        if ((o.description || '').toLowerCase().includes(query)) return true;
        if (state.showReturns) {
          return o.items.some(i => i.name.toLowerCase().includes(query));
        }
        return o.items.some(i => !i.isReturned && i.name.toLowerCase().includes(query));
      });
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.date.replace(/at.*/i, '').trim());
      const dateB = new Date(b.date.replace(/at.*/i, '').trim());
      return dateB - dateA;
    });
    
    return filtered;
  }
  
  function render() {
    const filtered = getFilteredOrders();
    console.log('Rendering:', filtered.length, 'orders (total:', state.orders.length, ')');
    
    const currentExpanded = new Set(state.expandedOrders);
    
    if (filtered.length === 0) {
      elements.emptyState.style.display = 'block';
      elements.ordersList.innerHTML = '';
      elements.emptyState.querySelector('p').textContent = 
        state.orders.length === 0 ? 'No orders captured yet.' : 'No orders match your filters.';
    } else {
      elements.emptyState.style.display = 'none';
      elements.ordersList.innerHTML = filtered.map(order => renderOrder(order)).join('');
      attachOrderListeners();
      
      currentExpanded.forEach(orderId => {
        const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (card) card.classList.add('expanded');
      });
    }
    
    renderSummary();
  }
  
  function renderOrder(order) {
    const payerClass = order.payer === 'Unknown' ? 'unknown' : '';
    
    let statusBadges = '';
    if (order.isFullyReturned) {
      statusBadges += '<span class="return-badge">Returned</span>';
    } else if (order.isPartialReturn) {
      statusBadges += '<span class="return-badge partial">⚠️ Partial Return</span>';
    }
    
    const returnedClass = order.isFullyReturned ? 'returned' : (order.isPartialReturn ? 'partial-return' : '');
    const ignoredClass = order.ignored ? 'ignored' : '';
    
    const cardBadge = order.cardEnding ? `<span class="card-badge">****${order.cardEnding}</span>` : '';
    
    const displayItems = state.showReturns 
      ? order.items 
      : order.items.filter(i => !i.isReturned);
    
    const itemsHtml = displayItems.length > 0 
      ? displayItems.map((item, idx) => `
        <div class="item-row ${item.isReturned ? 'returned-item' : ''} ${item.ignored ? 'ignored' : ''}" data-item-idx="${idx}">
          <div class="item-info">
            <span class="item-name">${escapeHtml(item.name)}</span>
            ${item.quantity > 1 ? `<span class="item-qty">×${item.quantity}</span>` : ''}
            ${item.isReturned ? '<span class="item-returned-badge">Returned</span>' : ''}
            ${item.ignored ? '<span class="item-returned-badge">Ignored</span>' : ''}
          </div>
          <div class="item-actions">
            <span class="item-price">${item.price || '—'}</span>
            ${!item.isReturned ? `<button class="item-ignore-btn" data-action="ignore-item" data-order-id="${order.orderId}" data-item-idx="${idx}" title="Ignore item">✕</button>` : ''}
          </div>
        </div>
      `).join('')
      : (order.description ? `
        <div class="item-row">
          <div class="item-info">
            <span class="item-name">${escapeHtml(order.description)}</span>
          </div>
          <span class="item-price">${order.total}</span>
        </div>
      ` : '<div class="no-items">No items captured</div>');
    
    const orderUrl = `https://www.amazon.com/gp/your-account/order-details?orderID=${order.orderId}`;
    const ignoredCount = order.items ? order.items.filter(i => i.ignored).length : 0;
    
    return `
      <div class="order-card ${returnedClass} ${ignoredClass}" data-order-id="${order.orderId}">
        <div class="order-header">
          <div class="order-info">
            <div class="order-id"><a href="${orderUrl}" target="_blank" rel="noopener">#${order.orderId}</a></div>
            <div class="order-date">${escapeHtml(order.date)}</div>
            <div class="order-meta">
              ${cardBadge}
              ${order.payer !== 'N/A - Transaction' ? `<span class="payer-badge ${payerClass}">${escapeHtml(order.payer)}</span>` : ''}
              ${statusBadges}
              ${ignoredCount > 0 ? `<span class="return-badge partial">${ignoredCount} ignored</span>` : ''}
            </div>
          </div>
          <div class="order-right">
            <span class="order-total">${order.total}</span>
            <button class="order-ignore-btn" data-action="ignore-order" data-order-id="${order.orderId}" title="${order.ignored ? 'Un-ignore order' : 'Ignore order'}">${order.ignored ? '↩' : '✕'}</button>
            <span class="expand-icon">▶</span>
          </div>
        </div>
        <div class="order-items">${itemsHtml}</div>
      </div>
    `;
  }
  
  function renderSummary() {
    const filtered = getFilteredOrders();
    
    let totalItems = 0;
    let totalSpent = 0;
    let orderCount = 0;
    
    filtered.forEach(order => {
      if (order.isFullyReturned || order.ignored) return;
      
      orderCount++;
      
      if (order.items && order.items.length > 0) {
        const nonReturnedItems = order.items.filter(i => !i.isReturned && !i.ignored);
        totalItems += nonReturnedItems.reduce((sum, i) => sum + i.quantity, 0);
        
        const ignoredItemsTotal = order.items.filter(i => i.ignored).reduce((sum, i) => {
          return sum + parsePrice(i.price) * i.quantity;
        }, 0);
        
        totalSpent += parsePrice(order.total) - ignoredItemsTotal;
      } else {
        totalSpent += parsePrice(order.total);
      }
    });
    
    elements.totalItems.textContent = totalItems;
    elements.totalSpent.textContent = formatPrice(totalSpent);
    elements.totalOrders.textContent = orderCount;
  }
  
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  function attachOrderListeners() {
    document.querySelectorAll('.order-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.order-card');
        const orderId = card.dataset.orderId;
        card.classList.toggle('expanded');
        if (card.classList.contains('expanded')) {
          state.expandedOrders.add(orderId);
        } else {
          state.expandedOrders.delete(orderId);
        }
      });
    });
    
    document.querySelectorAll('[data-action="ignore-order"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const orderId = btn.dataset.orderId;
        toggleOrderIgnored(orderId);
      });
    });
    
    document.querySelectorAll('[data-action="ignore-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const orderId = btn.dataset.orderId;
        const itemIdx = parseInt(btn.dataset.itemIdx);
        toggleItemIgnored(orderId, itemIdx);
      });
    });
  }
  
  function toggleOrderIgnored(orderId) {
    const order = state.orders.find(o => o.orderId === orderId);
    if (order) {
      order.ignored = !order.ignored;
      saveOrders();
      render();
    }
  }
  
  function toggleItemIgnored(orderId, itemIdx) {
    const order = state.orders.find(o => o.orderId === orderId);
    if (order && order.items && order.items[itemIdx] !== undefined) {
      order.items[itemIdx].ignored = !order.items[itemIdx].ignored;
      saveOrders();
      render();
    }
  }
  
  function clearIgnoredItems() {
    let cleared = 0;
    state.orders.forEach(order => {
      if (order.ignored) {
        order.ignored = false;
        cleared++;
      }
      if (order.items) {
        order.items.forEach(item => {
          if (item.ignored) {
            item.ignored = false;
            cleared++;
          }
        });
      }
    });
    if (cleared > 0) {
      saveOrders();
      render();
      showToast(`Cleared ${cleared} ignored items`);
    } else {
      showToast('No ignored items');
    }
  }
  
  function expandAllOrders() {
    state.orders.forEach(order => {
      state.expandedOrders.add(order.orderId);
    });
    document.querySelectorAll('.order-card').forEach(card => {
      card.classList.add('expanded');
    });
  }
  
  function collapseAllOrders() {
    state.expandedOrders.clear();
    document.querySelectorAll('.order-card').forEach(card => {
      card.classList.remove('expanded');
    });
  }
  
  function saveOrders() {
    chrome.runtime.sendMessage({
      type: 'SAVE_ORDERS',
      orders: state.orders
    });
  }
  
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    setTimeout(() => {
      elements.toast.classList.remove('visible');
    }, 2500);
  }
  
  function exportTSV() {
    const scope = elements.exportScope.value;
    const orders = scope === 'filtered' ? getFilteredOrders() : state.orders;
    const rows = [['Order ID', 'Date', 'Payer', 'Card', 'Item', 'Price', 'Qty', 'Status']];
    
    const escapeForTSV = (str) => {
      const s = String(str || '');
      if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    
    orders.forEach(order => {
      order.items.forEach(item => {
        rows.push([
          order.orderId,
          order.date,
          order.payer,
          order.cardEnding ? '****' + order.cardEnding : '',
          item.name,
          item.price || '',
          item.quantity || 1,
          item.isReturned ? 'Returned' : 'Purchased'
        ]);
      });
      if (order.items.length === 0) {
        rows.push([
          order.orderId,
          order.date,
          order.payer,
          order.cardEnding ? '****' + order.cardEnding : '',
          order.description || 'N/A',
          order.total || '',
          1,
          order.hasReturn ? 'Returned' : 'Purchased'
        ]);
      }
    });
    
    const tsv = rows.map(row => row.map(cell => escapeForTSV(cell)).join('\t')).join('\n');
    const utf8BOM = '\uFEFF';
    const blob = new Blob([utf8BOM + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-orders-${new Date().toISOString().split('T')[0]}.tsv`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast(`Exported ${orders.length} orders to TSV`);
  }
  
  function backupData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      orders: state.orders,
      settings: state.settings
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-orders-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Backup created');
  }
  
  function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.orders || !Array.isArray(data.orders)) {
          throw new Error('Invalid backup file');
        }
        
        chrome.runtime.sendMessage({ 
          type: 'RESTORE_DATA', 
          data: data 
        }, (response) => {
          if (response && response.success) {
            state.orders = data.orders;
            if (data.settings) {
              state.settings = { ...state.settings, ...data.settings };
            }
            updateFilters();
            render();
            showToast(`Restored ${data.orders.length} orders`);
          }
        });
      } catch (err) {
        showToast('Failed to restore: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
  
  function openClearModal() {
    elements.clearModal.classList.add('visible');
  }
  
  function closeClearModal() {
    elements.clearModal.classList.remove('visible');
  }
  
  function clearData() {
    chrome.runtime.sendMessage({ type: 'CLEAR_DATA' }, () => {
      state.orders = [];
      updateFilters();
      render();
      closeClearModal();
      showToast('Data cleared');
    });
  }
  
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.clearSearch.classList.toggle('visible', state.searchQuery.length > 0);
    render();
  });
  
  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearch.classList.remove('visible');
    render();
  });
  
  elements.showReturns.addEventListener('change', (e) => {
    state.showReturns = e.target.checked;
    render();
  });
  
  initMultiSelectHandlers();
  
  elements.expandAll.addEventListener('click', expandAllOrders);
  elements.collapseAll.addEventListener('click', collapseAllOrders);
  elements.clearIgnored.addEventListener('click', clearIgnoredItems);
  elements.trackingToggle.addEventListener('click', toggleTracking);
  elements.exportBtn.addEventListener('click', exportTSV);
  elements.backupBtn.addEventListener('click', backupData);
  elements.restoreBtn.addEventListener('click', () => elements.restoreInput.click());
  elements.restoreInput.addEventListener('change', restoreData);
  elements.clearBtn.addEventListener('click', openClearModal);
  
  elements.closeClearModal.addEventListener('click', closeClearModal);
  elements.cancelClear.addEventListener('click', closeClearModal);
  elements.confirmClear.addEventListener('click', clearData);
  elements.clearModal.addEventListener('click', (e) => {
    if (e.target === elements.clearModal) closeClearModal();
  });
  
  function updateCaptureNotification(captureStatus) {
    if (captureStatus.inProgress) {
      let msg = captureStatus.message;
      if (captureStatus.queueLength && captureStatus.queueLength > 0) {
        msg += ` (${captureStatus.queueLength} pending)`;
      }
      elements.captureMessage.textContent = msg;
      elements.captureNotification.classList.add('visible');
      state.notifiedDone = false;
    } else if (captureStatus.done && !state.notifiedDone) {
      elements.captureNotification.classList.remove('visible');
      showToast('Done! ' + state.orders.length + ' orders');
      state.notifiedDone = true;
    } else if (!captureStatus.inProgress && !captureStatus.done) {
      elements.captureNotification.classList.remove('visible');
    }
  }
  
  loadData();
  
  setInterval(() => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
        if (data) {
          if (data.orders) {
            const newCount = data.orders.length;
            const oldCount = state.orders.length;
            state.orders = data.orders;
            state.settings = data.settings || { trackingEnabled: true };
            state.queueLength = data.queueLength || 0;
            updateFilters();
            render();
          }
          if (data.captureStatus) {
            updateCaptureNotification(data.captureStatus);
          }
        }
      });
    } catch (e) {
      console.log('Polling error:', e);
    }
  }, 3000);
})();
