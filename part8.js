const fs = require('fs');

const part8 = `
    // ----------------------------------------------------
    // HOJA 2: LIBRO MAYOR (Vinculado por Fórmulas)
    // ----------------------------------------------------
    const wsMayor = wb.addWorksheet('Libro Mayor');
    
    wsMayor.columns = [
        { width: 12 }, // Fecha (A)
        { width: 15 }, // Asiento (B)
        { width: 45 }, // Concepto (C)
        { width: 15 }, // Débito (D)
        { width: 15 }, // Crédito (E)
        { width: 15 }  // Saldo (F)
    ];

    // FILTRADO CRÍTICO: Solo cuentas con actividad real (Débito > 0 o Crédito > 0)
    const accountsWithActivity = new Set();
    journal.forEach(e => e.lines.forEach(l => {
        if (l.d > 0 || l.h > 0) {
            accountsWithActivity.add(l.c);
        }
    }));
    
    // Ordenarlas jerárquicamente
    const sortedCodes = Array.from(accountsWithActivity).sort((a, b) => a.localeCompare(b));

    sortedCodes.forEach(code => {
        const acc = dbCatalog.find(x => x.c === code) || { c: code, n: 'Cuenta Desconocida' };
        
        // Encabezado de la Cuenta
        const titleRow = wsMayor.addRow([\`NOMBRE DE CUENTA: \${acc.c} - \${acc.n.toUpperCase()}\`]);
        titleRow.font = { bold: true, size: 12 };
        wsMayor.mergeCells(\`A\${titleRow.number}:F\${titleRow.number}\`);
        
        wsMayor.addRow([]);

        // Encabezados de Tabla del Mayor
        const headerRow = wsMayor.addRow(['FECHA', 'ASIENTO', 'CONCEPTO', 'DÉBITO', 'CRÉDITO', 'SALDO']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F1117' } };
        headerRow.alignment = { horizontal: 'center' };

        let startDataRow = wsMayor.lastRow.number + 1;
        let currentDataRow = startDataRow;

        journal.forEach((entry, idx) => {
            const eMap = diarioMap[entry.id];
            // Filtrar SOLO las líneas de ESTE asiento para ESTA cuenta que tengan valores reales
            const linesForAcc = eMap.lines.filter(l => l.c === code && (l.d > 0 || l.h > 0));
            
            if (linesForAcc.length > 0) {
                linesForAcc.forEach(l => {
                    // Celdas conectadas vía Fórmulas Relativas a la Hoja del Diario
                    const r = wsMayor.addRow([
                        { formula: \`='Libro Diario'!A\${eMap.firstLineRow}\` }, // F1: Fecha
                        { formula: \`='Libro Diario'!C\${eMap.numRow}\` },       // F2: Num Asiento
                        { formula: \`='Libro Diario'!C\${eMap.glosaRow}\` },     // F3: Concepto (Glosa)
                        { formula: \`='Libro Diario'!E\${l.row}\` },             // F4: Débito
                        { formula: \`='Libro Diario'!F\${l.row}\` },             // F5: Crédito
                        0 // Placeholder para Saldo (F6)
                    ]);
                    
                    r.getCell(1).alignment = { horizontal: 'center' };
                    r.getCell(2).alignment = { horizontal: 'center' };
                    r.getCell(4).numFmt = '#,##0.00';
                    r.getCell(5).numFmt = '#,##0.00';
                    r.getCell(6).numFmt = '#,##0.00';

                    // FÓRMULA DEL SALDO ACUMULATIVO
                    if (currentDataRow === startDataRow) {
                        r.getCell(6).value = { formula: \`D\${currentDataRow}-E\${currentDataRow}\` };
                    } else {
                        r.getCell(6).value = { formula: \`F\${currentDataRow-1}+D\${currentDataRow}-E\${currentDataRow}\` };
                    }
                    currentDataRow++;
                });
            }
        });

        // Espaciadores entre cuentas en el Excel
        wsMayor.addRow([]);
        wsMayor.addRow([]);
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), \`Sistema_Contable_Completo_\${Date.now()}.xlsx\`);
    showToast("Exportación completada exitosamente.");
}

function navigate(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('view-'+id).classList.add('active');
    document.getElementById('nav-'+id).classList.add('active');
    if(id === 'catalogo') renderCatalog();
    if(id === 'mayor' && currentMayorCode) renderMayorTable();
}

function showToast(m) {
    const t = document.getElementById('toast');
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

async function resetDB() {
    const confirmed = await showCustomModal('Limpiar Base de Datos', '¿Estás seguro de borrar todas las cuentas, asientos y plantillas?', 'confirm');
    if(confirmed) {
        localStorage.clear();
        location.reload();
    }
}

// --- MOTOR DRAG AND DROP ---
function initDragAndDrop() {
    const container = document.getElementById('lines-container');
    let draggedRow = null;

    container.addEventListener('dragstart', e => {
        const row = e.target.closest('.line-row');
        if(row) {
            draggedRow = row;
            setTimeout(() => row.classList.add('dragging'), 0);
        }
    });

    container.addEventListener('dragend', e => {
        if(draggedRow) {
            draggedRow.classList.remove('dragging');
            draggedRow = null;
        }
    });

    container.addEventListener('dragover', e => {
        e.preventDefault(); 
        const afterElement = getDragAfterElement(container, e.clientY);
        if (draggedRow) {
            if (afterElement == null) {
                container.appendChild(draggedRow);
            } else {
                container.insertBefore(draggedRow, afterElement);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.line-row:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

document.addEventListener('click', e => {
    if(!e.target.closest('.autocomplete-wrapper')) {
        document.querySelectorAll('.suggestions').forEach(s => s.style.display = 'none');
    }
});
</script>
</body>
</html>
`;
fs.appendFileSync('index.html', part8);
