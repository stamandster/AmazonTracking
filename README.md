# AmazonTracking

A Chrome extension side panel that elegantly captures and tracks your Amazon order history. Styled like Medium's clean reading experience with warm typography and thoughtful design.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Features

### Smart Order Capture
- **Automatic Detection** - Automatically captures orders when you browse Amazon order history pages
- **Order Enrichment** - Fetches detailed order information including card used, tax, and refund amounts
- **Return Tracking** - Detects partial and full returns, calculates adjusted totals
- **Per-Shipment Detection** - Correctly handles orders with multiple shipments

### Filtering & Search
- **Multi-Select Filters** - Filter by year, card, and payer simultaneously
- **Real-Time Search** - Search across order IDs, payer names, and item descriptions
- **Show/Hide Returns** - Toggle to include or exclude returned orders
- **Expand/Collapse All** - Quickly expand or collapse all orders

### Data Management
- **Start/Stop Tracking** - Toggle tracking on/off without losing data
- **Ignore Items/Orders** - Exclude specific items or orders from totals
- **Export to TSV** - Export filtered or all orders (tab-separated for comma-safe item names)
- **Backup/Restore** - Export and import your complete order history as JSON
- **Clear Data** - Remove all captured data with confirmation

### Design
- **Medium-Inspired UI** - Warm off-white background, serif headings, monospace prices
- **Responsive Side Panel** - Opens in Chrome's side panel (400px width)
- **Collapsible Orders** - Click to expand and see item details
- **Clickable Order IDs** - Open Amazon order details in new tab

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `AmazonOrders` folder

### From Chrome Web Store
*(Coming soon)*

## Usage

1. Click the extension icon in Chrome's toolbar to open the side panel
2. Navigate to your Amazon order history (`amazon.com/gp/your-orders/`)
3. Orders are automatically captured and displayed in the panel
4. Use multi-select filters to narrow down by year, payment card, or payer
5. Click an order to expand and see individual items
6. Click the order ID to open the full order details on Amazon

### Tracking Control

- Click **"Stop Tracking"** button to pause capturing
- Click **"Start Tracking"** to resume
- Tracking state persists across sessions

### Ignoring Items

- Click the ✕ button next to an item to exclude it from totals
- Click the ✕ button next to an order total to ignore the entire order
- Use **"Clear Ignored"** to un-ignore all items at once

### Exporting Data

1. Select **"Filtered"** or **"All Orders"** from the scope dropdown
2. Click **"Export TSV"** to download
3. For full backups, use **"Backup"** button (JSON format)

## Supported Pages

The extension automatically detects and captures data from:
- `/your-orders/` - Order list page
- `/gp/your-account/order-details` - Individual order details
- `/cpe/yourpayments/transactions` - Transaction history
- `/gp/css/` - Order CSS pages

## Data Storage

| Storage Type | Survives Restart | Survives History Clear |
|-------------|------------------|------------------------|
| chrome.storage.local | Yes | No |
| JSON Backup File | Yes | Yes |

**Important:** Your order data is stored locally in Chrome. Use the Backup feature to create a JSON export before clearing browser data.

## Permissions

- `side_panel` - Required to open the extension in Chrome's side panel
- `activeTab` - Required to inject content script on Amazon pages
- `storage` - Required to save order data locally
- Host permissions for `*.amazon.com` - Required to read order pages

## Technical Stack

- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** - No framework dependencies
- **CSS Custom Properties** - For theming consistency
- **Message Passing** - Communication between content script, background, and panel

## File Structure

```
AmazonOrders/
├── manifest.json      # Extension manifest (V3)
├── background.js      # Service worker for storage & messaging
├── content.js         # Content script for parsing Amazon pages
├── sidepanel.html    # Side panel UI structure
├── sidepanel.css     # Medium-styled CSS
├── sidepanel.js      # Side panel logic
├── SPEC.md           # Detailed specification
└── icon*.png         # Extension icons
```

## Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

## Disclaimer

**This extension is provided "as is" without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.**

**No Support:** Support is not guaranteed. Bug reports and feature requests may or may not be addressed. Pull requests are welcome but there is no obligation to merge them.

**Use at your own risk:** This extension reads data from Amazon.com web pages. Amazon's page structure may change at any time, which could cause the extension to stop working or produce incorrect data. Always verify important information directly on Amazon.com.

## License

MIT License - see repository for details

## Acknowledgments

- Design inspired by Medium.com's editorial warmth
- Icon made with simplicity in mind
