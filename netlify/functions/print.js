exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Method not allowed. Use POST.' 
      })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { items, orderNo, dateTime, printerIP, printerPort, connectionType } = data;

    // Validate required data
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided');
    }
    
    if (!orderNo) {
      throw new Error('Order number is required');
    }

    // Log the print request (for debugging)
    console.log('Print request received:', {
      orderNo,
      itemCount: items.length,
      printerIP,
      connectionType
    });

    // Since we can't actually print from a serverless function,
    // we'll simulate the printing process and return success
    
    // In a real implementation, you would:
    // 1. Send data to a printing service API
    // 2. Queue the job in a database
    // 3. Send to a local printer service via webhook
    // 4. Use a printing service like PrintNode API

    // For now, we'll simulate successful printing
    const receipt = {
      orderNo,
      items,
      dateTime,
      totalAmount: items.reduce((sum, item) => sum + (item.qty * item.price), 0),
      timestamp: new Date().toISOString()
    };

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Print request processed successfully!',
        orderNo: orderNo,
        receipt: receipt,
        note: 'This is a simulation. To enable actual printing, integrate with a printing service.'
      })
    };

  } catch (error) {
    console.error('Print function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
