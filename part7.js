const fs = require('fs');

const part7 = `
// --- RENDERIZADOS ---
function renderJournal() {
    const tbody = document.getElementById('journal-tbody');
    tbody.innerHTML = '';
    
    const formatFmt = (val) => val > 0 ? parseFloat(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
    
    [...journal].reverse().forEach(entry => {
        let isHaberSection = false;
        let rowsHtml = '';

        entry.lines.forEach((l, idx) => {
            if (l.t === 'H') isHaberSection = true;
            else if (l.t === 'D') isHaberSection = false;
            else {
                if (l.h > 0) isHaberSection = true;
                if (l.d > 0) isHaberSection = false;
            }

            let indent = 0;
            if (l.c.length > 4) indent += 1.5;
            if (isHaberSection) indent += 3;

            rowsHtml += \`
                <tr>
                    <td class="mono" style="font-size:0.75rem; text-align:center">\${idx === 0 ? entry.date : ''}</td>
                    <td class="mono" style="font-weight:600;color:var(--accent);text-align:center">\${l.c}</td>
                    <td style="padding-left:calc(1rem + \${indent}rem)">\${l.n}</td>
                    <td class="text-right mono">\${formatFmt(l.p)}</td>
                    <td class="text-right mono">\${formatFmt(l.d)}</td>
                    <td class="text-right mono">\${formatFmt(l.h)}</td>
                </tr>
            \`;
        });
        
        rowsHtml += \`
            <tr style="background:var(--surface2); border-bottom: 2px solid var(--border2)">
                <td colspan="2"></td>
                <td colspan="3" style="font-style:italic; color:var(--ink2); padding-left:1rem; vertical-align:middle;">
                    v/r: \${entry.glosa} <span style="margin-left:1rem;color:var(--ink3);font-size:0.7rem">(REF: \${entry.id})</span>
                </td>
                <td class="text-right" style="white-space: nowrap;">
                    <button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.75rem; border:none; color:var(--accent); margin-right:5px;" onclick="editEntry(\${entry.id})">✏️ Editar</button>
                    <button class="btn btn-danger" style="padding:0.4rem 0.8rem; font-size:0.75rem; border:none;" onclick="deleteEntry(\${entry.id})">🗑️ Eliminar</button>
                </td>
            </tr>
        \`;

        tbody.innerHTML += rowsHtml;
    });
}

let isDeletingEntry = false;
async function deleteEntry(id) {
    if (isDeletingEntry) return; 
    isDeletingEntry = true;
    try {
        const confirmed = await showCustomModal('Eliminar Asiento', '¿Está seguro de eliminar este asiento? Esta acción no se puede deshacer.', 'confirm');
        if (confirmed) {
            const initialLength = journal.length;
            journal = journal.filter(e => e.id !== id); 
            
            if (journal.length !== initialLength) {
                localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(journal)); 
                renderJournal(); 
                if(currentMayorCode) renderMayorTable(); 
                showToast("Asiento eliminado correctamente.");
            }
        }
    } finally {
        isDeletingEntry = false;
    }
}

function renderCatalog() {
    const q = document.getElementById('cat-search').value.toLowerCase();
    const tbody = document.getElementById('catalog-tbody');
    const counter = document.getElementById('catalog-counter');
    
    const filtered = dbCatalog
        .filter(x => x.c.includes(q) || x.n.toLowerCase().includes(q))
        .sort((a, b) => {
            const aStart = a.c.startsWith(q);
            const bStart = b.c.startsWith(q);
            if (aStart && !bStart) return -1;
            if (!aStart && bStart) return 1;
            return a.c.localeCompare(b.c);
        });

    counter.innerHTML = \`Mostrando <b>\${filtered.length.toLocaleString()}</b> de <b>\${dbCatalog.length.toLocaleString()}</b> registros totales\`;

    tbody.innerHTML = filtered.map(x => {
        let style = '';
        if (x.l === 1) style = 'font-weight:800; background:#e2e5ec; text-transform:uppercase; color:var(--ink); border-top:2px solid var(--border2);';
        else if (x.l === 2) style = 'font-weight:700; background:var(--surface2); color:var(--ink2);';
        else if (x.l === 3) style = 'font-weight:600; color:var(--ink2);';
        else style = 'font-weight:400; color:var(--ink3);';

        return \`
        <tr style="\${style}">
            <td class="mono">\${x.c}</td>
            <td style="padding-left:\${(x.l-1)*15}px">\${x.n}</td>
            <td style="font-size:0.7rem;opacity:0.7">Nivel \${x.l}</td>
        </tr>
        \`;
    }).join('');
}

// --- EXPORTACIÓN UNIFICADA (DIARIO Y MAYOR CON FÓRMULAS VIVAS) ---
async function exportSistemaCompleto() {
    if(journal.length === 0) { showToast("Nada que exportar en el Diario."); return; }
    
    showToast("Generando Sistema Completo, por favor espere...");

    const wb = new ExcelJS.Workbook();

    // ----------------------------------------------------
    // HOJA 1: LIBRO DIARIO
    // ----------------------------------------------------
    const wsDiario = wb.addWorksheet('Libro Diario');

    wsDiario.columns = [
        { header: 'FECHA', key: 'f', width: 12 },
        { header: 'CÓDIGO', key: 'c', width: 15 },
        { header: 'DETALLE', key: 'n', width: 45 },
        { header: 'PARCIAL', key: 'p', width: 15 },
        { header: 'DEBE', key: 'd', width: 15 },
        { header: 'HABER', key: 'h', width: 15 }
    ];

    wsDiario.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    wsDiario.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F1117' } };
    wsDiario.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Mapa lógico de dónde queda cada dato en la hoja de Excel
    const diarioMap = {};

    journal.forEach((e, journalIndex) => {
        let isHaberSection = false;

        const numRowObj = wsDiario.addRow({ n: \`- \${journalIndex + 1} -\` });
        numRowObj.getCell('n').alignment = { horizontal: 'center' };
        numRowObj.getCell('n').font = { bold: true };
        const numRow = numRowObj.number;

        const entryData = { numRow: numRow, lines: [] };
        let firstLineRow = null;

        e.lines.forEach((l, index) => {
            if (l.t === 'H') isHaberSection = true;
            else if (l.t === 'D') isHaberSection = false;
            else {
                if (l.h > 0) isHaberSection = true;
                if (l.d > 0) isHaberSection = false;
            }

            const r = wsDiario.addRow({ 
                f: index === 0 ? e.date : '', 
                c: l.c, 
                n: l.n, 
                p: l.p > 0 ? l.p : null,
                d: l.d > 0 ? l.d : null, 
                h: l.h > 0 ? l.h : null 
            });

            if (index === 0) firstLineRow = r.number;

            entryData.lines.push({
                c: l.c,
                row: r.number,
                d: l.d || 0,
                h: l.h || 0
            });

            let indent = 0;
            if (l.c.length > 4) {
                indent += 1; 
            } else {
                r.getCell('c').font = { bold: true };
                r.getCell('n').font = { bold: true };
            }
            
            if (isHaberSection) {
                indent += 4;
            }

            if (indent > 0) {
                r.getCell('n').alignment = { indent: indent };
            }
            
            r.getCell('c').alignment = { horizontal: 'center' };
            r.getCell('f').alignment = { horizontal: 'center' };

            ['p', 'd', 'h'].forEach(col => {
                const cell = r.getCell(col);
                if(cell.value) cell.numFmt = '#,##0.00';
            });
        });

        const gRow = wsDiario.addRow({ c: '', n: \`v/r: \${e.glosa}\` });
        gRow.font = { italic: true };
        gRow.getCell('n').alignment = { indent: 1 };
        
        entryData.glosaRow = gRow.number;
        entryData.firstLineRow = firstLineRow;
        diarioMap[e.id] = entryData;

        wsDiario.addRow([]); 
    });


`;
fs.appendFileSync('index.html', part7);
