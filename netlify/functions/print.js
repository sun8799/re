const net = require('net');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Only POST method allowed' 
      })
    };
  }

  try {
    // Parse request data
    const data = JSON.parse(event.body);
    const { 
      items = [], 
      orderNo = '', 
      dateTime = '', 
      printerIP = '192.168.1.100', 
      printerPort = 9100,
      connectionType = 'network'
    } = data;

    // Validate required data
    if (!items.length || !orderNo) {
      throw new Error('Missing required data: items and orderNo');
    }

    console.log('Processing print request:', { orderNo, itemCount: items.length, printerIP });

    // Generate ESC/POS commands
    const escposCommands = generateESCPOSCommands(items, orderNo, dateTime);
    
    // Send to thermal printer
    if (connectionType === 'network') {
      await sendToPrinter(printerIP, printerPort, escposCommands);
    } else {
      throw new Error('Only network printers supported in serverless environment');
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Receipt printed successfully!',
        orderNo: orderNo,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Print error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Generate ESC/POS commands for thermal printer
function generateESCPOSCommands(items, orderNo, dateTime) {
  let commands = [];
  
  // Initialize printer
  commands.push('\x1B\x40'); // ESC @ - Initialize
  
  // Header with proper alignment
  commands.push('\x1B\x61\x02'); // Right align for PAID
  commands.push('\x1B\x21\x08'); // Bold
  commands.push('PAID\n');
  
  commands.push('\x1B\x61\x01'); // Center align
  commands.push('\x1B\x21\x18'); // Double height + Bold
  commands.push('Rajalakshmi Engineering College\n');
  commands.push('\x1B\x21\x00'); // Normal text
  commands.push('REC_CAFE_KIOSK_5\n');
  
  commands.push('\x1B\x61\x00'); // Left align
  commands.push('-'.repeat(48) + '\n');
  commands.push(`Date: ${dateTime}\n`);
  commands.push('\x1B\x21\x08'); // Bold for order number
  commands.push(`Order No: ${orderNo}\n`);
  commands.push('\x1B\x21\x00'); // Normal
  commands.push('-'.repeat(48) + '\n');
  
  // Header row
  const headerLine = formatReceiptLine('Item', 'Qty', 'Pr.', 'Amt(Rs.)');
  commands.push(headerLine + '\n');
  commands.push('-'.repeat(48) + '\n');
  
  let totalQty = 0;
  let totalAmount = 0;
  
  // Items with proper formatting
  items.forEach(item => {
    const amount = item.qty * item.price;
    const formattedLine = formatReceiptLine(item.name, item.qty, item.price.toFixed(2), amount.toFixed(2));
    
    // Bold item name, normal rest
    commands.push('\x1B\x21\x08'); // Bold
    commands.push(formattedLine.substring(0, 20)); // Item name part
    commands.push('\x1B\x21\x00'); // Normal
    commands.push(formattedLine.substring(20) + '\n'); // Rest of line
    
    totalQty += item.qty;
    totalAmount += amount;
  });
  
  // Total
  commands.push('-'.repeat(48) + '\n');
  const totalLine = formatReceiptLine('Total', totalQty, '', totalAmount.toFixed(2));
  commands.push(totalLine + '\n');
  commands.push('-'.repeat(48) + '\n');
  
  // Footer
  commands.push('\x1B\x61\x01'); // Center align
  commands.push('Billing powered by POSITEASY.in\n');
  commands.push('\n\n\n'); // Line feeds
  commands.push('\x1D\x56\x01'); // Partial cut
  
  return commands.join('');
}

// Format receipt line with proper column alignment
function formatReceiptLine(item, qty, price, amount) {
  const ITEM_WIDTH = 20;
  const QTY_WIDTH = 4;
  const PRICE_WIDTH = 8;
  const AMOUNT_WIDTH = 10;
  
  // Format item name (left-aligned, truncate if too long)
  let itemStr = item.toString().substring(0, ITEM_WIDTH);
  itemStr = itemStr.padEnd(ITEM_WIDTH, ' ');
  
  // Format quantity (center-aligned)
  let qtyStr = qty.toString();
  let qtyPadLeft = Math.floor((QTY_WIDTH - qtyStr.length) / 2);
  let qtyPadRight = QTY_WIDTH - qtyPadLeft - qtyStr.length;
  qtyStr = ' '.repeat(qtyPadLeft) + qtyStr + ' '.repeat(qtyPadRight);
  
  // Format price (right-aligned)
  let priceStr = price.toString();
  priceStr = priceStr.padStart(PRICE_WIDTH, ' ');
  
  // Format amount (right-aligned)
  let amountStr = amount.toString();
  amountStr = amountStr.padStart(AMOUNT_WIDTH, ' ');
  
  return itemStr + qtyStr + ' ' + priceStr + ' ' + amountStr;
}

// Send data to thermal printer via TCP/IP
function sendToPrinter(printerIP, printerPort, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(10000); // 10 second timeout
    
    client.connect(printerPort, printerIP, () => {
      console.log(`Connected to printer ${printerIP}:${printerPort}`);
      client.write(data);
      client.end();
    });
    
    client.on('close', () => {
      console.log('Printer connection closed');
      resolve();
    });
    
    client.on('error', (error) => {
      console.error('Printer connection error:', error);
      reject(new Error(`Printer connection failed: ${error.message}`));
    });
    
    client.on('timeout', () => {
      console.error('Printer connection timeout');
      client.destroy();
      reject(new Error('Printer connection timeout'));
    });
  });
}