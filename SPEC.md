# AmazonTracking - Chrome Extension Spec

## Concept & Vision

A Chrome side panel extension that elegantly captures Amazon order data as users browse their order history. Styled like Medium's clean reading experience—warm, typography-forward, distraction-free. The extension silently observes page navigation through orders, building a searchable inventory while specifically flagging items purchased by a designated individual.

## Design Language

**Aesthetic Direction:** Medium.com's editorial warmth—generous whitespace, readable typography, subtle shadows, cream-tinted backgrounds that feel like reading a well-designed magazine rather than crunching data.

**Color Palette:**
- Background: `#FAFAF8` (warm off-white)
- Surface: `#FFFFFF`
- Primary text: `#1A1A1A`
- Secondary text: `#6B6B6B`
- Accent: `#22863A` (Amazon green for positive actions)
- Danger: `#CB2431`
- Border: `#E8E8E8`
- Hover: `#F7F7F5`

**Typography:**
- Headings: `'Charter', 'Georgia', serif` - Medium uses a custom Charter
- Body: `'Segoe UI', system-ui, sans-serif`
- Prices/Data: `'SF Mono', 'Consolas', monospace`
- Base size: 15px, line-height: 1.6

**Spatial System:**
- Base unit: 8px
- Content padding: 24px
- Section gaps: 32px
- Card padding: 20px

**Motion Philosophy:**
- Subtle fade-ins (opacity 0→1, 200ms ease-out) for list items
- Smooth accordion expand/collapse (height + opacity, 250ms)
- Gentle hover transitions (150ms)
- No jarring movements—everything should feel like turning pages

## Layout & Structure

**Side Panel Dimensions:** 400px width, full viewport height

**Page Structure:**
```
┌─────────────────────────────────┐
│  📦 Order Tracker   [⚙️] [Track]│  Header with logo/title, tracking toggle
├─────────────────────────────────┤
│  [🔍 Search items...]           │  Search bar
│  [Year: ▼] [Card: ▼] [Payer ▼] │  Filter dropdowns
│  [☑ Show returns]               │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Order #123 - Jan 15       │  │  Collapsible order card
│  │ Payer: John Doe           │  │
│  │ Total: $45.99             │  │
│  │ ├─ Item 1 ($12.99)        │  │  Nested item list
│  │ └─ Item 2 ($32.99)        │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📊 Summary                │  │  Stats summary panel
│  │ Total Items: 47           │  │
│  │ Total Spent: $1,234.56    │  │
│  │ Your Spending: $XXX.XX    │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  [Filtered ▼] [Export TSV]      │  Export with scope selector
│  [📥 Backup] [📤 Restore] [Clear]│  Data management
└─────────────────────────────────┘
```
┌─────────────────────────────────┐
│  ≡ Amazon Order Tracker         │  Header with logo/title
├─────────────────────────────────┤
│  [🔍 Search items...]           │  Search bar
│  [Payer: ▼ All                 ]│  Payer filter dropdown
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Order #123 - Jan 15       │  │  Collapsible order card
│  │ Payer: John Doe           │  │
│  │ Total: $45.99             │  │
│  │ ├─ Item 1 ($12.99)        │  │  Nested item list
│  │ └─ Item 2 ($32.99)        │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📊 Summary                │  │  Stats summary panel
│  │ Total Items: 47           │  │
│  │ Total Spent: $1,234.56   │  │
│  │ Your Spending: $XXX.XX   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Features & Interactions

### Core Features

1. **Order Page Detection**
   - Automatically detects Amazon order history pages
   - Extracts order number, date, total, payer, and line items
   - Works on `/gp/your-account/order-details` and order list pages

2. **Data Extraction**
   - Order ID, order date
   - Payer name (looks for "Shipped to" or "Paid by" fields)
   - Individual item names, quantities, prices
   - Order total
   - Card ending digits
   - Tax and refund amounts

3. **Payer Designation**
   - User sets their target payer name in settings
   - Items purchased by that person are visually distinguished
   - Running tally of that person's spending

4. **Inventory View**
   - All items compiled into searchable list
   - Grouped by order or flat list view toggle
   - Price displayed prominently
   - Orders sorted newest to oldest

5. **Start/Stop Tracking**
   - Toggle button to enable/disable tracking
   - When disabled, no orders are captured
   - State persists across sessions

6. **Persistence & Backup**
   - Data stored in chrome.storage.local (survives browser restart, not history clearing)
   - Export to TSV (Tab-Separated Values) for items with commas
   - Export scope: filtered view or all orders
   - Manual backup to JSON file (recommended for permanent archive)
   - Restore from JSON backup file
   - Clear data option with confirmation modal

### Interactions

- **Click order card:** Expands to show line items (accordion style)
- **Hover on item:** Subtle highlight
- **Search:** Real-time filtering as user types
- **Payer filter:** Dropdown to show all items vs. specific payer
- **Settings gear:** Opens modal to set target payer name

### Edge Cases

- Orders with returns—mark as "Returned" and exclude from counts
- Partial returns (some items returned, others not)—flag for review, show which items were returned
- Orders with no items (gift cards, etc.)—show message
- Orders where payer can't be determined—mark as "Unknown"
- Very long item names—truncate with ellipsis, show full on hover
- Duplicate orders (page refresh)—don't add twice

## Component Inventory

### Header
- Extension icon (📦 or similar) + "Order Tracker" title
- Start/Stop Tracking toggle button (green when active, gray when stopped)
- Settings gear icon (top right)
- Border-bottom separator

### Search Bar
- Full-width input with search icon
- Placeholder: "Search items..."
- Clear button appears when text entered

### Payer Filter
- Dropdown select styled to match Medium's minimalism
- Options: "All payers" + any unique payers found

### Year Filter
- Dropdown to filter by transaction year
- Extracts year from order/transaction dates

### Card Filter
- Dropdown showing card ending digits (••••1234)
- Filters to show only transactions on specific payment method

### Order Card
- **Default:** Collapsed, shows order#, date, payer badge, total
- **Hover:** Slight background color shift to `#F7F7F5`
- **Expanded:** Shows nested item list with smooth height animation
- **Payer badge:** Small pill showing payer name (green if matches target)

### Item Row
- Item name (truncated if long)
- Price aligned right (monospace font)
- Quantity badge if > 1

### Summary Panel
- Fixed at bottom of panel
- Shows: Total items, total spent, target payer's spending
- Collapsible on mobile-ish narrow widths

### Settings Modal
- Overlay with semi-transparent backdrop
- Input for target payer name
- Save/Cancel buttons
- Close on backdrop click or X

### Actions Bar
- Export scope dropdown: "Filtered" or "All Orders"
- Export TSV button (uses tabs instead of commas to handle item names with commas)
- Backup button (downloads JSON file with all data)
- Restore button (imports JSON backup file)
- Clear Data button (with confirmation modal)

### Data Management
- **chrome.storage.local**: Survives browser restart, cleared when user clears browsing data
- **Backup/Restore**: Recommended for long-term archival. Export to JSON before clearing browser data
- **Export Format**: TSV (Tab-Separated Values) to handle item names containing commas

## Technical Approach

**Manifest V3** Chrome Extension with:
- `side_panel` declared in manifest
- Content script injected on Amazon order pages
- Background script for storage management
- Popup not needed—everything in side panel

**Data Model:**
```javascript
{
  orders: [
    {
      orderId: "123-XXXXXXX",
      date: "2024-01-15",
      payer: "John Doe",
      total: 45.99,
      originalTotal: 45.99,
      cardEnding: "8568",
      description: "AMZN Mktp US",
      type: "charge",
      items: [
        { name: "Item Name", price: 12.99, quantity: 1, isReturned: false }
      ],
      hasReturn: false,
      isFullyReturned: false,
      isPartialReturn: false,
      refundTotal: "",
      tax: "$2.42",
      status: "complete"
    }
  ],
  settings: {
    targetPayer: "John Doe",
    trackingEnabled: true
  }
}
```

**Content Script Strategy:**
- Match patterns: `*://*.amazon.com/gp/your-account/*`
- Parse DOM for order data using specific Amazon selectors
- Send data to background via message passing
- Visual indicator when data is captured (subtle toast)

**Storage:** 
- chrome.storage.local (survives browser restart, NOT cleared browsing data)
- Backup recommended: Export to JSON file for long-term archival
- Export: TSV format (tabs instead of commas) to handle item names with commas
