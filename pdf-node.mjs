import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable/es'
import fs from 'node:fs'

/* global Buffer */

const doc = new jsPDF()
autoTable(doc, {
  head: [['Name', 'Email', 'Plan']],
  body: [
    ['Jones-Murphy Hotel', 'elva.klein@example.com', 'basic'],
    ['MRK Hotels Platform', 'platform@mrkhotels.test', 'trial'],
    ['The Highlands Beach Hotel', 'info@highlands.example.com', 'premium'],
  ],
  styles: { fontSize: 8 },
  headStyles: { fillColor: [0, 94, 184] },
})
fs.writeFileSync('/tmp/opencode/node-es.pdf', Buffer.from(doc.output('arraybuffer')))
console.log('generated /tmp/opencode/node-es.pdf')
