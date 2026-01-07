# Zebra ZPL Direct Printing for Next.js

Direct network printing to Zebra thermal printers using ZPL (Zebra Programming Language) via TCP socket.

## Features

- No printer drivers needed
- No browser print dialog
- Works with any Zebra printer (ZD230, ZD420, ZT230, etc.)
- Support for multiple label sizes
- QR codes, barcodes, text, shapes
- 180 degree rotation support

## Installation

### 1. Copy API Route

Copy `api-route.ts` to your Next.js project:

```
src/app/api/zebra-print/route.ts
```

### 2. Copy Client Utility

Copy `zebra-client.ts` to your project:

```
src/lib/zebra-client.ts
```

### 3. Use in Your Components

```tsx
import { testZebraPrinter, printBadge } from "@/lib/zebra-client"

// Test connection
const result = await testZebraPrinter("192.168.1.100")

// Print badge
const result = await printBadge("192.168.1.100", {
  name: "John Doe",
  badge_type: "Attendee",
  badge_id: "ATT001"
})
```

## Printer Setup

### Requirements

1. Zebra printer connected to network (same network as server)
2. Printer IP address (find in printer menu or use Zebra Setup Utilities)
3. Port 9100 must be accessible (default Zebra raw port)
4. Printer language set to **ZPL** (not EPL)

### Common Printer Settings

Access via printer web interface (http://PRINTER_IP):

| Setting | Value |
|---------|-------|
| Print Language | ZPL |
| Network Port | 9100 |
| Print Mode | Tear Off or Peel Off |

## API Reference

### POST /api/zebra-print

#### Test Print
```json
{
  "printer_ip": "192.168.1.100",
  "printer_port": 9100,
  "test_print": true
}
```

#### Badge Print
```json
{
  "printer_ip": "192.168.1.100",
  "data": {
    "name": "John Doe",
    "title": "Engineer",
    "company": "Tech Corp",
    "badge_type": "Attendee",
    "badge_id": "ATT001",
    "event_name": "Conference 2024",
    "paper_size": "4x6",
    "rotation": 0
  }
}
```

#### Raw ZPL
```json
{
  "printer_ip": "192.168.1.100",
  "zpl": "^XA^FO50,50^A0N,50,50^FDHello^FS^XZ"
}
```

### GET /api/zebra-print

Query parameters:
- `ip` - Printer IP address (required)
- `port` - Printer port (default: 9100)
- `action` - `test` (default), `calibrate`, or `clear-queue`

Examples:
```
GET /api/zebra-print?ip=192.168.1.100
GET /api/zebra-print?ip=192.168.1.100&action=calibrate
GET /api/zebra-print?ip=192.168.1.100&action=clear-queue
```

## Label Sizes

| Size | Width (dots) | Height (dots) | Inches |
|------|--------------|---------------|--------|
| 4x6  | 812          | 1218          | 4" x 6"|
| 4x3  | 812          | 609           | 4" x 3"|
| 4x2  | 812          | 406           | 4" x 2"|
| 3x2  | 609          | 406           | 3" x 2"|
| 2x1  | 406          | 203           | 2" x 1"|

> Note: Zebra printers use 203 DPI (dots per inch)

## ZPL Quick Reference

```zpl
^XA              // Start label
^XZ              // End label
^FO100,50        // Field origin (x,y in dots)
^A0N,30,30       // Font (name, height, width)
^FD...^FS        // Field data
^FB400,2,0,C     // Field block (width, max lines, spacing, alignment)
^GB200,100,3     // Graphic box (width, height, border)
^BQN,2,5         // QR code (orientation, model, magnification)
^BCN,100,Y,N,N   // Code 128 barcode
^PON             // Print orientation normal
^POI             // Print orientation inverted (180 degrees)
```

## Client Utilities

The `zebra-client.ts` provides both functional and class-based APIs:

### Functional API

```typescript
import {
  testZebraPrinter,
  printBadge,
  printRawZPL,
  calibratePrinter,
  clearPrintQueue,
} from "@/lib/zebra-client"

// Test connection
await testZebraPrinter("192.168.1.100")

// Print badge
await printBadge("192.168.1.100", { name: "John Doe" })

// Print raw ZPL
await printRawZPL("192.168.1.100", "^XA^FD...^FS^XZ")

// Calibrate (after loading new labels)
await calibratePrinter("192.168.1.100")

// Clear stuck jobs
await clearPrintQueue("192.168.1.100")
```

### Class-based API

```typescript
import { ZebraPrinter } from "@/lib/zebra-client"

const printer = new ZebraPrinter({ ip: "192.168.1.100" })

await printer.test()
await printer.printBadge({ name: "John Doe" })
await printer.calibrate()
await printer.clearQueue()
```

## Troubleshooting

### "Connection timeout"
- Check printer IP is correct
- Verify printer is on same network
- Check firewall allows port 9100

### "Connection refused"
- Printer may be offline
- Port 9100 may be blocked
- Try restarting printer

### Prints blank labels
- Check printer language is ZPL (not EPL)
- Verify media is loaded correctly
- Run printer calibration

### Label not aligned
- Run media calibration on printer
- Check label size settings match actual media

## Files Included

```
zebra-print-standalone/
├── api-route.ts          # Next.js API route (copy to src/app/api/zebra-print/route.ts)
├── zebra-client.ts       # Client utilities (copy to src/lib/zebra-client.ts)
├── example-component.tsx # React example component
└── README.md             # This file
```

## License

MIT - Use freely in your projects.
