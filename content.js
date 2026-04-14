(function() {
  console.log('AmazonTracking: Content script loaded');
  
  let trackingEnabled = true;
  let isInitialized = false;
  let extensionValid = true;
  
  function safeSendMessage(message, callback) {
    if (!extensionValid) {
      if (callback) callback(null);
      return;
    }
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        extensionValid = false;
        if (callback) callback(null);
        return;
      }
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          extensionValid = false;
          if (callback) callback(null);
          return;
        }
        if (callback) callback(response);
      });
    } catch (e) {
      extensionValid = false;
      console.log('AmazonTracking: Extension context error');
      if (callback) callback(null);
    }
  }
  
  function checkTrackingState() {
    if (!extensionValid) return;
    safeSendMessage({ type: 'GET_TRACKING_STATE' }, (response) => {
      if (response === null) return;
      trackingEnabled = response !== false;
      console.log('AmazonTracking: Tracking state:', trackingEnabled ? 'enabled' : 'disabled');
    });
  }
  
  checkTrackingState();
  setInterval(checkTrackingState, 5000);
  
  const ORDER_PATTERNS = [
    /amazon\.com\/your-orders/,
    /amazon\.com\/gp\/your-account.*order/,
    /amazon\.com\/.*order.*details/,
    /amazon\.com\/cpe\/yourpayments\/transactions/,
    /amazon\.com\/gp\/css\/.*order/
  ];
  
  function isOrderPage() {
    return ORDER_PATTERNS.some(p => p.test(window.location.href));
  }
  
  function parseTransactionPage() {
    const transactions = [];
    
    const lineItems = document.querySelectorAll('.apx-transactions-line-item-component-container');
    console.log('AmazonTracking: Found', lineItems.length, 'line items');
    
    lineItems.forEach((item) => {
      const cardEl = item.querySelector('.a-span9');
      const amountEl = item.querySelector('.a-span3');
      const orderLink = item.querySelector('a[href*="orderID="]');
      const descEl = item.querySelector('.a-span12');
      
      const cardText = cardEl?.textContent?.trim() || '';
      const amountText = amountEl?.textContent?.trim() || '';
      const orderHref = orderLink?.getAttribute('href') || '';
      let description = descEl?.textContent?.trim() || 'Amazon';
      if (description.includes('Order #')) description = 'Amazon';
      
      const cardMatch = cardText.match(/(Mastercard|Visa|Amex|Discover)\s+\*{4}(\d{4})/);
      const orderMatch = orderHref.match(/orderID=([A-Z0-9-]+)/i);
      const amountMatch = amountText.match(/([+-]?\$[\d,]+\.\d{2})/);
      
      const cardEnding = cardMatch ? cardMatch[2] : '';
      const orderId = orderMatch ? orderMatch[1] : '';
      const amtText = amountMatch ? amountMatch[1] : '';
      
      let dateText = '';
      let dateContainer = item.closest('.a-box');
      if (!dateContainer) dateContainer = item.parentElement?.closest('.a-box');
      if (!dateContainer) {
        let parent = item.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          const dateEl = parent.querySelector?.('.apx-transaction-date-container span');
          if (dateEl) {
            dateText = dateEl.textContent?.trim() || '';
            break;
          }
          parent = parent.parentElement;
        }
      } else {
        const dateEl = dateContainer.querySelector('.apx-transaction-date-container span');
        dateText = dateEl?.textContent?.trim() || '';
      }
      
      if (orderId && amtText) {
        const isRefund = amtText.startsWith('+') || amountText.includes('+');
        
        const transaction = {
          orderId: orderId,
          date: dateText,
          payer: 'N/A - Transaction',
          total: amtText,
          cardEnding: cardEnding,
          description: description.substring(0, 200),
          type: isRefund ? 'refund' : 'charge',
          items: [{
            name: description.substring(0, 200),
            price: amtText.replace(/[()+-]/g, ''),
            quantity: 1,
            isReturned: isRefund
          }],
          hasReturn: isRefund,
          isFullyReturned: isRefund,
          isPartialReturn: false,
          status: 'complete'
        };
        
        if (!transactions.some(t => t.orderId === transaction.orderId)) {
          transactions.push(transaction);
        }
      }
    });
    
    console.log('AmazonTracking: Parsed', transactions.length, 'transactions');
    return transactions;
  }
  
  function parseOrderListPage() {
    const orders = [];
    
    const orderCards = document.querySelectorAll('.order-card');
    console.log('AmazonTracking: Found', orderCards.length, 'order cards');
    
    orderCards.forEach(card => {
      const cardText = card.textContent?.toLowerCase() || '';
      if (cardText.includes('order was cancelled') || cardText.includes('cancelled')) {
        return;
      }
      
      const orderIdEl = card.querySelector('.yohtmlc-order-id span[dir="ltr"]');
      const orderId = orderIdEl?.textContent?.trim() || '';
      
      const headerItems = card.querySelectorAll('.order-header__header-list-item');
      let date = '';
      let total = '';
      let payer = 'Unknown';
      
      headerItems.forEach(item => {
        const label = item.querySelector('.a-color-secondary.a-text-caps');
        const value = item.querySelector('.a-size-base');
        const labelText = label?.textContent?.trim() || '';
        const valueText = value?.textContent?.trim() || '';
        
        if (labelText.includes('Order placed') && !date) {
          date = valueText;
        }
        if (labelText.includes('Total') && !total) {
          total = valueText;
        }
      });
      
      const recipientEl = card.querySelector('.yohtmlc-recipient h5');
      if (recipientEl) {
        payer = recipientEl.textContent?.trim() || 'Unknown';
      }
      
      const hasReturn = card.querySelector('[class*="return"]') !== null;
      
      const items = [];
      const deliveryBoxes = card.querySelectorAll('.delivery-box');
      deliveryBoxes.forEach(box => {
        const productTitle = box.querySelector('.yohtmlc-product-title a');
        if (productTitle) {
          const name = productTitle.textContent?.trim() || '';
          if (name) {
            items.push({
              name: name.substring(0, 200),
              price: '',
              quantity: 1,
              isReturned: false
            });
          }
        }
      });
      
      if (orderId && !orders.some(o => o.orderId === orderId)) {
        orders.push({
          orderId,
          date,
          payer,
          total,
          cardEnding: '',
          items,
          hasReturn,
          isFullyReturned: false,
          isPartialReturn: false,
          status: 'pending'
        });
      }
    });
    
    console.log('AmazonTracking: Parsed', orders.length, 'orders from list page');
    return orders;
  }
  
  async function fetchOrderDetails(orderId) {
    const url = `https://www.amazon.com/your-orders/order-details?orderID=${orderId}&ref=ppx_yo2ov_dt_b_fed_order_details`;
    
    console.log('Fetching details for:', orderId);
    
    try {
      const response = await fetch(url, { credentials: 'include' });
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const bodyText = doc.body?.textContent || '';
      const pageText = bodyText.toLowerCase();
      
      const cardMatch = bodyText.match(/ending in (\d{4})/i);
      const cardEnding = cardMatch ? cardMatch[1] : '';
      
      console.log('Fetched details for', orderId, '- card:', cardEnding);
      
      let total = '';
      let refundTotal = '';
      let tax = '';
      const odLineItems = doc.querySelectorAll('.od-line-item-row');
      odLineItems.forEach(row => {
        const label = row.querySelector('.od-line-item-row-label')?.textContent || '';
        const content = row.querySelector('.od-line-item-row-content')?.textContent || '';
        if (label.includes('Grand Total')) {
          const match = content.match(/\$[\d,]+\.\d{2}/);
          if (match) total = match[0];
        }
        if (label.includes('Refund Total')) {
          const match = content.match(/\$[\d,]+\.\d{2}/);
          if (match) refundTotal = match[0];
        }
        if (label.includes('Estimated tax')) {
          const match = content.match(/\$[\d,]+\.\d{2}/);
          if (match) tax = match[0];
        }
      });
      
      console.log('Order summary - total:', total, 'refundTotal:', refundTotal, 'tax:', tax);
      
      const items = [];
      doc.querySelectorAll('[data-component="purchasedItems"]').forEach(item => {
        const nameEl = item.querySelector('[data-component="itemTitle"] a');
        const name = nameEl?.textContent?.trim() || 
                    item.querySelector('.a-link-normal')?.textContent?.trim() || '';
        
        const priceEl = item.querySelector('[data-component="unitPrice"]');
        const priceText = priceEl?.textContent || '';
        const priceMatch = priceText.match(/\$[\d,]+\.\d{2}/);
        const price = priceMatch ? priceMatch[0] : '';
        
        const qtyEl = item.querySelector('.od-item-view-qty');
        const qtyText = qtyEl?.textContent?.trim() || '1';
        const qty = parseInt(qtyText) || 1;
        
        if (name) {
          items.push({ name, price, quantity: qty, isReturned: false });
        }
      });
      
      doc.querySelectorAll('[data-component="shipmentsLeftGrid"]').forEach(shipment => {
        const allChildren = shipment.querySelectorAll('*');
        let statusText = '';
        let purchasedItemsGrid = null;
        
        allChildren.forEach(child => {
          const comp = child.getAttribute('data-component');
          if (comp === 'shipmentStatus') {
            statusText = child.textContent?.toLowerCase() || '';
          }
          if (comp === 'purchasedItems') {
            purchasedItemsGrid = child;
          }
        });
        
        const shipmentIsReturned = statusText.includes('return complete') || 
                                    statusText.includes('return was completed') ||
                                    statusText.includes('your return is complete') ||
                                    statusText.includes('refund issued') ||
                                    statusText.includes('refund has been issued');
        
        if (shipmentIsReturned && purchasedItemsGrid) {
          purchasedItemsGrid.querySelectorAll('[data-component="purchasedItemsRightGrid"]').forEach(itemBlock => {
            const nameEl = itemBlock.querySelector('[data-component="itemTitle"] a');
            const name = nameEl?.textContent?.trim();
            if (name) {
              const item = items.find(i => i.name === name);
              if (item) {
                item.isReturned = true;
                console.log('Marked as returned:', name, '- price:', item.price);
              } else {
                console.log('Return item NOT matched:', name);
              }
            }
          });
        }
      });
      
      const hasReturn = items.some(i => i.isReturned);
      const isFullyReturned = items.length > 0 && items.every(i => i.isReturned);
      const isPartialReturn = hasReturn && !isFullyReturned;
      
      let adjustedTotal = total;
      if (hasReturn && !isFullyReturned && items.length > 0) {
        let returnedAmount = 0;
        if (refundTotal) {
          returnedAmount = parseFloat(refundTotal.replace(/[^0-9.]/g, ''));
          console.log('Using refund total:', returnedAmount);
          const totalVal = parseFloat((total || '0').replace(/[^0-9.]/g, ''));
          const newTotal = totalVal - returnedAmount;
          adjustedTotal = newTotal > 0 ? '$' + newTotal.toFixed(2) : '$0.00';
          console.log('Return calc:', { totalVal, returnedAmount, newTotal, adjustedTotal, isPartialReturn });
        } else {
          let itemsReturnAmount = 0;
          items.forEach(item => {
            if (item.isReturned) {
              const priceVal = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''));
              itemsReturnAmount += priceVal * item.quantity;
            }
          });
          const taxVal = tax ? parseFloat(tax.replace(/[^0-9.]/g, '')) : 0;
          const totalVal = parseFloat((total || '0').replace(/[^0-9.]/g, ''));
          const newTotal = totalVal - itemsReturnAmount - taxVal;
          adjustedTotal = newTotal > 0 ? '$' + newTotal.toFixed(2) : '$0.00';
          console.log('Return calc (items):', { totalVal, itemsReturnAmount, taxVal, newTotal, adjustedTotal, isPartialReturn });
        }
      }
      
      return { 
        cardEnding, 
        items,
        total: adjustedTotal,
        originalTotal: total,
        tax,
        refundTotal,
        hasReturn,
        isFullyReturned,
        isPartialReturn,
        status: isFullyReturned ? 'returned' : (isPartialReturn ? 'partial_return' : 'complete')
      };
    } catch (err) {
      console.log('AmazonTracking: Failed to fetch order details for', orderId, err);
      return null;
    }
  }
  
  function parseOrderDetailPage() {
    const pageText = document.body?.textContent?.toLowerCase() || '';
    if (pageText.includes('order was cancelled')) {
      return { orderId: 'CANCELLED', items: [], status: 'cancelled' };
    }
    
    const orderIdMatch = window.location.href.match(/orderID=([A-Z0-9-]+)/i) ||
                         window.location.href.match(/\/order-details\/([A-Z0-9-]+)/i);
    const orderId = orderIdMatch ? orderIdMatch[1] : 'Unknown';
    
    const date = document.querySelector('[data-testid="orderDetailsOrderInfoDate"]')?.textContent?.trim() ||
                 document.querySelector('.order-date')?.textContent?.trim() || '';
    
    const payerEl = document.querySelector('[data-component="shippingAddress"]');
    const payer = payerEl?.textContent?.trim()?.split('\n')[0]?.trim() || 'Unknown';
    
    const totalEl = document.querySelector('.grand-total') || 
                   document.querySelector('[class*="Grand Total"]') ||
                   document.querySelector('.a-text-bold');
    const totalText = totalEl?.textContent || '';
    const totalMatch = totalText.match(/\$[\d,]+\.\d{2}/);
    const total = totalMatch ? totalMatch[0] : '';
    
    let tax = '';
    const bodyText = document.body.innerText;
    const taxMatch = bodyText.match(/(?:tax|vat|gst)\s*\$[\d,]+\.\d{2}/i);
    if (taxMatch) {
      const taxPriceMatch = taxMatch[0].match(/\$[\d,]+\.\d{2}/);
      if (taxPriceMatch) tax = taxPriceMatch[0];
    }
    
    const cardMatch = bodyText.match(/ending in (\d{4})/i);
    const cardEnding = cardMatch ? cardMatch[1] : '';
    
    const items = [];
    document.querySelectorAll('[data-component="purchasedItems"]').forEach(item => {
      const nameEl = item.querySelector('[data-component="itemTitle"] a');
      const name = nameEl?.textContent?.trim() || 
                   item.querySelector('.a-link-normal')?.textContent?.trim() || '';
      
      const priceEl = item.querySelector('[data-component="unitPrice"]');
      const priceText = priceEl?.textContent || '';
      const priceMatch = priceText.match(/\$[\d,]+\.\d{2}/);
      const price = priceMatch ? priceMatch[0] : '';
      
      const qtyEl = item.querySelector('.od-item-view-qty');
      const qtyText = qtyEl?.textContent?.trim() || '1';
      const qty = parseInt(qtyText) || 1;
      
      if (name) {
        items.push({ name, price, quantity: qty, isReturned: false });
      }
    });
    
    document.querySelectorAll('[data-component="shipmentsLeftGrid"]').forEach(shipment => {
      const allChildren = shipment.querySelectorAll('*');
      let statusText = '';
      let purchasedItemsGrid = null;
      
      allChildren.forEach(child => {
        const comp = child.getAttribute('data-component');
        if (comp === 'shipmentStatus') {
          statusText = child.textContent?.toLowerCase() || '';
        }
        if (comp === 'purchasedItems') {
          purchasedItemsGrid = child;
        }
      });
      
      const shipmentIsReturned = statusText.includes('return complete') || 
                                  statusText.includes('return was completed') ||
                                  statusText.includes('your return is complete') ||
                                  statusText.includes('refund issued') ||
                                  statusText.includes('refund has been issued');
      
      if (shipmentIsReturned && purchasedItemsGrid) {
        purchasedItemsGrid.querySelectorAll('[data-component="purchasedItemsRightGrid"]').forEach(itemBlock => {
          const nameEl = itemBlock.querySelector('[data-component="itemTitle"] a');
          const name = nameEl?.textContent?.trim();
          if (name) {
            const item = items.find(i => i.name === name);
            if (item) item.isReturned = true;
          }
        });
      }
    });
    
    const hasReturn = items.some(i => i.isReturned);
    const isFullyReturned = items.length > 0 && items.every(i => i.isReturned);
    const isPartialReturn = hasReturn && !isFullyReturned;
    
    let adjustedTotal = total;
    if (hasReturn && !isFullyReturned) {
      let returnedAmount = 0;
      items.forEach(item => {
        if (item.isReturned) {
          const priceVal = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''));
          returnedAmount += priceVal * item.quantity;
        }
      });
      const taxVal = tax ? parseFloat(tax.replace(/[^0-9.]/g, '')) : 0;
      const totalVal = parseFloat((total || '0').replace(/[^0-9.]/g, ''));
      const newTotal = totalVal - returnedAmount - taxVal;
      adjustedTotal = newTotal > 0 ? '$' + newTotal.toFixed(2) : '$0.00';
    }
    
    return {
      orderId,
      date,
      payer,
      total: adjustedTotal,
      originalTotal: total,
      tax,
      cardEnding,
      items,
      hasReturn,
      isFullyReturned,
      isPartialReturn,
      status: isFullyReturned ? 'returned' : (isPartialReturn ? 'partial_return' : 'complete')
    };
  }
  
  async function extractOrders() {
    if (!isOrderPage()) return [];
    
    if (window.location.href.includes('order-details') || window.location.href.includes('orderID=')) {
      const order = parseOrderDetailPage();
      if (order.orderId === 'CANCELLED' || order.orderId === 'Unknown') return [];
      return [order];
    }
    
    if (window.location.href.includes('transactions') || window.location.href.includes('yourpayments')) {
      return parseTransactionPage();
    }
    
    return parseOrderListPageWithDetails();
  }
  
  function sendToBackground(orders) {
    orders.forEach(order => {
      safeSendMessage({
        type: 'ORDER_DATA',
        order: order
      }, (response) => {
        if (response && response.success) {
          console.log('AmazonTracking: Stored order', order.orderId);
        }
      });
    });
  }
  
  async function parseOrderListPageWithDetails() {
    const orders = parseOrderListPage();
    
    sendToBackground(orders);
    
    const ordersNeedingDetails = orders.filter(o => !o.cardEnding || o.items.some(i => !i.price));
    
    console.log('AmazonTracking: Fetching details for', ordersNeedingDetails.length, 'orders');
    
    for (let i = 0; i < ordersNeedingDetails.length; i++) {
      if (!trackingEnabled) {
        console.log('AmazonTracking: Tracking disabled during enrichment, stopping');
        break;
      }
      const order = ordersNeedingDetails[i];
      
      safeSendMessage({
        type: 'CAPTURE_PROGRESS',
        message: 'Querying order ' + (i + 1) + ' of ' + ordersNeedingDetails.length + '...'
      });
      
      const details = await fetchOrderDetails(order.orderId);
      if (details) {
        if (details.cardEnding) {
          order.cardEnding = details.cardEnding;
        }
        if (details.items.length > 0) {
          order.items = details.items;
        }
        if (details.total) {
          order.total = details.total;
          order.originalTotal = details.originalTotal || details.total;
          order.tax = details.tax || '';
        }
        if (details.hasReturn !== undefined) {
          order.hasReturn = details.hasReturn;
          order.isFullyReturned = details.isFullyReturned;
          order.isPartialReturn = details.isPartialReturn;
          order.status = details.status;
          order.refundTotal = details.refundTotal || '';
        }
        
        console.log('Enriched order', order.orderId, '- total:', order.total, '- card:', order.cardEnding, '- items:', order.items.length);
        
        safeSendMessage({
          type: 'ORDER_DATA',
          order: order
        });
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    safeSendMessage({ type: 'CAPTURE_DONE' });
    
    return orders;
  }
  
  function init() {
    if (!isOrderPage()) return;
    if (isInitialized) return;
    isInitialized = true;
    
    let lastCapture = 0;
    
    const capture = async () => {
      if (!trackingEnabled) {
        console.log('AmazonTracking: Tracking disabled, skipping capture');
        return;
      }
      
      const now = Date.now();
      if (now - lastCapture < 2000) {
        console.log('AmazonTracking: Skipping capture, too soon since last');
        return;
      }
      lastCapture = now;
      
      safeSendMessage({
        type: 'CAPTURE_START',
        message: 'Parsing page...'
      });
      
      const orders = await extractOrders();
      console.log('AmazonTracking: Captured', orders.length, 'orders');
      if (orders.length > 0) {
        sendToBackground(orders);
      } else {
        safeSendMessage({ type: 'CAPTURE_DONE' });
      }
    };
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(capture, 2000));
    } else {
      setTimeout(capture, 2000);
    }
    
    let lastOrderCount = 0;
    let lastHref = window.location.href;
    
    document.addEventListener('click', (e) => {
      const text = e.target.textContent?.trim() || '';
      const parentText = e.target.closest('[class*="button"]')?.textContent?.trim() || '';
      if (text.includes('Next') || parentText.includes('Next') || 
          text.includes('Previous') || parentText.includes('Previous') ||
          text.includes('Go to') || parentText.includes('Go to') ||
          e.target.closest('[class*="nextPage"]') || e.target.closest('[class*="prevPage"]') ||
          e.target.closest('input[class*="button"]') || e.target.closest('[class*="paginate"]')) {
        console.log('AmazonTracking: Page navigation clicked:', text || parentText);
        setTimeout(capture, 4000);
      }
    });
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        console.log('AmazonTracking: URL changed to', lastHref);
        setTimeout(capture, 3000);
        return;
      }
      
      const lineItems = document.querySelectorAll('.apx-transactions-line-item-component-container');
      if (lineItems.length !== lastOrderCount && lineItems.length > 0) {
        lastOrderCount = lineItems.length;
        console.log('AmazonTracking: DOM changed, re-capturing...');
        setTimeout(capture, 2000);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        console.log('AmazonTracking: URL changed (interval), re-capturing...');
        setTimeout(capture, 3000);
        return;
      }
      
      const lineItems = document.querySelectorAll('.apx-transactions-line-item-component-container');
      if (lineItems.length !== lastOrderCount && lineItems.length > 0) {
        lastOrderCount = lineItems.length;
        console.log('AmazonTracking: Interval detected change, re-capturing...');
        setTimeout(capture, 2000);
      }
    }, 3000);
  }
  
  init();
})();
