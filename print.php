<?php
require_once 'vendor/autoload.php';

use Mike42\Escpos\Printer;
use Mike42\Escpos\PrintConnectors\FilePrintConnector;

$connector = new FilePrintConnector("receipt.txt");
$printer = new Printer($connector);

$printer->text("Hello from PHP + Composer!\n");
$printer->cut();
$printer->close();

echo "Printed to receipt.txt";
?>
