<?php
/**
 * PHP Backend API for Thermal Printing
 * Handles AJAX requests from the frontend
 * Install: composer require mike42/escpos-php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'vendor/autoload.php';

use Mike42\Escpos\Printer;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;
use Mike42\Escpos\PrintConnectors\FilePrintConnector;

function formatReceiptLine($item, $qty, $price, $amount) {
    $itemWidth = 20;
    $qtyWidth = 4;
    $priceWidth = 8;
    $amountWidth = 10;
    
    // Format item name with proper padding
    $itemStr = substr($item, 0, $itemWidth);
    $itemStr = str_pad($itemStr, $itemWidth, ' ', STR_PAD_RIGHT);
    
    // Format quantity (center aligned)
    $qtyStr = str_pad($qty, $qtyWidth, ' ', STR_PAD_BOTH);
    
    // Format price (right aligned)
    $priceStr = str_pad(number_format($price, 2), $priceWidth, ' ', STR_PAD_LEFT);
    
    // Format amount (right aligned)
    $amountStr = str_pad(number_format($amount, 2), $amountWidth, ' ', STR_PAD_LEFT);
    
    return $itemStr . $qtyStr . ' ' . $priceStr . ' ' . $amountStr;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method allowed');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON data');
    }
    
    $items = $input['items'] ?? [];
    $orderNo = $input['orderNo'] ?? '';
    $dateTime = $input['dateTime'] ?? '';
    $printerIP = $input['printerIP'] ?? '192.168.1.100';
    $printerPort = (int)($input['printerPort'] ?? 9100);
    $connectionType = $input['connectionType'] ?? 'network';
    
    if (empty($items) || empty($orderNo)) {
        throw new Exception('Missing required data');
    }
    
    // Connect to printer based on connection type
    switch ($connectionType) {
        case 'network':
            $connector = new NetworkPrintConnector($printerIP, $printerPort);
            break;
        case 'usb':
            $connector = new WindowsPrintConnector("USB001");
            break;
        case 'serial':
            $connector = new FilePrintConnector("/dev/ttyUSB0");
            break;
        default:
            throw new Exception('Unsupported connection type');
    }
    
    $printer = new Printer($connector);
    
    // Print receipt header
    $printer->setJustification(Printer::JUSTIFY_RIGHT);
    $printer->selectPrintMode(Printer::MODE_EMPHASIZED);
    $printer->text("PAID\n");
    
    $printer->setJustification(Printer::JUSTIFY_CENTER);
    $printer->selectPrintMode(Printer::MODE_DOUBLE_HEIGHT | Printer::MODE_EMPHASIZED);
    $printer->text("Rajalakshmi Engineering College\n");
    $printer->selectPrintMode();
    $printer->text("REC_CAFE_KIOSK_5\n");
    
    $printer->setJustification(Printer::JUSTIFY_LEFT);
    $printer->text(str_repeat("-", 48) . "\n");
    $printer->text("Date: " . $dateTime . "\n");
    $printer->selectPrintMode(Printer::MODE_EMPHASIZED);
    $printer->text("Order No: " . $orderNo . "\n");
    $printer->selectPrintMode();
    $printer->text(str_repeat("-", 48) . "\n");
    
    // Print header row
    $printer->text(formatReceiptLine('Item', 'Qty', 'Pr.', 'Amt(Rs.)') . "\n");
    $printer->text(str_repeat("-", 48) . "\n");
    
    // Print items
    $totalQty = 0;
    $totalAmount = 0;
    
    foreach ($items as $item) {
        $amount = $item['qty'] * $item['price'];
        $line = formatReceiptLine($item['name'], $item['qty'], $item['price'], $amount);
        
        // Bold item name only
        $printer->selectPrintMode(Printer::MODE_EMPHASIZED);
        $printer->text(substr($line, 0, 20));
        $printer->selectPrintMode();
        $printer->text(substr($line, 20) . "\n");
        
        $totalQty += $item['qty'];
        $totalAmount += $amount;
    }
    
    // Print total
    $printer->text(str_repeat("-", 48) . "\n");
    $printer->text(formatReceiptLine('Total', $totalQty, '', $totalAmount) . "\n");
    $printer->text(str_repeat("-", 48) . "\n");
    
    // Print footer
    $printer->setJustification(Printer::JUSTIFY_CENTER);
    $printer->text("Billing powered by POSITEASY.in\n");
    $printer->feed(3);
    $printer->cut();
    $printer->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'Receipt printed successfully!',
        'orderNo' => $orderNo
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    error_log("Thermal printer API error: " . $e->getMessage());
}
?>