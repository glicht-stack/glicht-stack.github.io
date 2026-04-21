const fs = require('fs');

const part6 = `
function editEntry(id) {
    const entry = journal.find(e => e.id === id);
    if (!entry) return;

    editingEntryId = id;
    document.getElementById('form-title').textContent = "✏️ Editando Asiento";
    document.getElementById('entry-form-container').classList.add('editing-mode-active');
    document.getElementById('btn-post-entry').textContent = "Actualizar Asiento";
    document.getElementById('btn-cancel-edit').style.display = "inline-flex";

    document.getElementById('entry-date').value = entry.date;
    document.getElementById('entry-glosa').value = entry.glosa;

    document.getElementById('lines-container').innerHTML = '';
    entry.lines.forEach(l => {
        addLine(l.c, l.n, l.t, l.p, l.d, l.h);
    });

    calcTotals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit(showMsg = true) {
    editingEntryId = null;
    document.getElementById('form-title').textContent = "Voucher Contable";
    document.getElementById('entry-form-container').classList.remove('editing-mode-active');
    document.getElementById('btn-post-entry').textContent = "Postear Asiento";
    document.getElementById('btn-cancel-edit').style.display = "none";
    
    document.getElementById('entry-date').valueAsDate = new Date();
    document.getElementById('entry-glosa').value = '';
    
    document.getElementById('lines-container').innerHTML = '';
    for(let i=0; i<3; i++) addLine();
    calcTotals();
    
    if (showMsg) showToast("Edición cancelada.");
}

function postEntry() {
    const date = document.getElementById('entry-date').value;
    const glosa = document.getElementById('entry-glosa').value;
    const totD = parseCurrency(document.getElementById('total-debe').textContent);
    const totH = parseCurrency(document.getElementById('total-haber').textContent);

    if(!date || !glosa) { showToast("Fecha y Glosa obligatorias"); return; }
    if(Math.abs(totD - totH) > 0.01 || totD === 0) { showToast("Asiento descuadrado o vacío"); return; }

    const lines = [];
    let hasErrors = false;

    document.querySelectorAll('.line-row').forEach(row => {
        const c = row.dataset.selectedCode; 
        const inputValue = row.querySelector('.input-code').value;
        const n = row.querySelector('.input-name').value;
        const typeBtn = row.querySelector('.btn-toggle-type');
        
        if (inputValue && !c) {
            hasErrors = true;
            row.querySelector('.input-code').classList.add('error');
        } else if (c && n) {
            lines.push({
                c, n, 
                t: typeBtn ? typeBtn.dataset.type : null,
                p: parseCurrency(row.querySelector('.input-parcial').value),
                d: parseCurrency(row.querySelector('.input-debe').value),
                h: parseCurrency(row.querySelector('.input-haber').value)
            });
        }
    });

    if(hasErrors) {
        showToast("Existen cuentas sin validar. Debe seleccionar o crear correctamente las cuentas en rojo.");
        return;
    }

    const entryData = { id: editingEntryId || Date.now(), date, glosa, lines };

    if (editingEntryId) {
        const index = journal.findIndex(e => e.id === editingEntryId);
        if (index !== -1) journal[index] = entryData;
        showToast("Asiento actualizado.");
    } else {
        journal.push(entryData);
        showToast("Asiento posteado.");
    }
    
    localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(journal));
    
    cancelEdit(false);
    renderJournal();
    if(currentMayorCode) renderMayorTable(); 
}

// --- LÓGICA DE ÁRBOL DEL MAYOR Y SELECCIÓN ---
function toggleNode(e, code) {
    e.stopPropagation();
    if (expandedNodes.has(code)) expandedNodes.delete(code);
    else expandedNodes.add(code);
    renderMayorTree();
}

function renderMayorTree() {
    const q = document.getElementById('mayor-tree-search').value.toLowerCase();
    const container = document.getElementById('mayor-tree-container');
    let html = '';

    const sortedCatalog = [...dbCatalog].sort((a, b) => a.c.localeCompare(b.c));

    sortedCatalog.forEach(acc => {
        const isMatch = acc.c.includes(q) || acc.n.toLowerCase().includes(q);
        
        let isVisible = true;
        if (!q) {
            let parent = getParentCode(acc.c);
            while (parent) {
                if (!expandedNodes.has(parent)) {
                    isVisible = false;
                    break;
                }
                parent = getParentCode(parent);
            }
        } else {
            if (!isMatch) isVisible = false;
        }

        if (!isVisible) return;

        const pad = (acc.l - 1) * 15;
        const hasChildren = sortedCatalog.some(x => x.c !== acc.c && x.c.startsWith(acc.c) && x.l > acc.l);
        
        const toggleIcon = hasChildren 
            ? \`<span onclick="toggleNode(event, '\${acc.c}')" style="cursor:pointer; width:15px; display:inline-block; text-align:center; font-size:0.7rem; color:var(--ink3)">\${expandedNodes.has(acc.c) && !q ? '▼' : '▶'}</span>\` 
            : \`<span style="width:15px; display:inline-block;"></span>\`;

        const bg = currentMayorCode === acc.c ? 'var(--accent-pale)' : 'transparent';
        const weight = acc.l <= 2 ? 'bold' : 'normal';

        html += \`
            <div style="padding-left:\${pad}px; background:\${bg}; padding-top:6px; padding-bottom:6px; border-radius:4px; display:flex; align-items:center; gap:5px;" class="tree-item hover-bg">
                \${toggleIcon}
                <div style="cursor:pointer; flex:1; font-weight:\${weight}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" onclick="selectMayorAcc('\${acc.c}', '\${acc.n.replace(/'/g, "")}')" title="\${acc.c} - \${acc.n}">
                    <span class="mono" style="color:var(--accent);">\${acc.c}</span> 
                    <span style="font-size:0.8rem; color:var(--ink2); margin-left:4px;">\${acc.n}</span>
                </div>
            </div>
        \`;
    });
    container.innerHTML = html;
}

function selectMayorAcc(code, name) {
    currentMayorCode = code;
    currentMayorName = name;
    document.getElementById('mayor-acc-name').textContent = \`NOMBRE DE CUENTA: \${code} - \${name.toUpperCase()}\`;
    renderMayorTree(); 
    renderMayorTable();
}

function renderMayorTable() {
    const tbody = document.getElementById('mayor-tbody');
    if (!currentMayorCode) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--ink3); padding: 2rem;">Seleccione una cuenta a la izquierda para generar el libro mayor.</td></tr>';
        return;
    }

    let saldo = 0;
    let rowsHtml = '';
    let hasData = false;

    const formatFmt = (val) => val !== 0 ? parseFloat(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';

    journal.forEach((entry, idx) => {
        let totalD = 0;
        let totalH = 0;
        
        entry.lines.forEach(l => {
            if (l.c.startsWith(currentMayorCode)) {
                totalD += l.d || 0;
                totalH += l.h || 0;
            }
        });

        if (totalD > 0 || totalH > 0) {
            hasData = true;
            saldo += (totalD - totalH);
            
            rowsHtml += \`
                <tr>
                    <td class="mono" style="font-size:0.75rem; text-align:center;">\${entry.date}</td>
                    <td class="mono text-center" style="text-align:center; color:var(--ink3)">#\${idx + 1}</td>
                    <td>\${entry.glosa}</td>
                    <td class="text-right mono" style="color:var(--ink)">\${formatFmt(totalD)}</td>
                    <td class="text-right mono" style="color:var(--ink)">\${formatFmt(totalH)}</td>
                    <td class="text-right mono" style="font-weight:600; background:var(--surface2); color:\${saldo < 0 ? 'var(--red)' : 'var(--accent)'}">\${formatFmt(saldo)}</td>
                </tr>
            \`;
        }
    });

    if (!hasData) {
        rowsHtml = '<tr><td colspan="6" style="text-align:center; color:var(--ink3); padding: 2rem;">No hay movimientos en el diario para esta cuenta o sus subcuentas.</td></tr>';
    }

    tbody.innerHTML = rowsHtml;
}

`;
fs.appendFileSync('index.html', part6);
