const fs = require('fs');

const part4 = `
async function saveTemplate() {
    const lines = [];
    let hasErrors = false;

    document.querySelectorAll('.line-row').forEach((row, index) => {
        const c = row.dataset.selectedCode;
        const typeBtn = row.querySelector('.btn-toggle-type');
        
        if (c) {
            lines.push({ c: c, t: typeBtn ? typeBtn.dataset.type : 'D', order: index });
        } else if (row.querySelector('.input-code').value.trim() !== '') {
            hasErrors = true; 
        }
    });

    if (hasErrors) { showToast("Hay cuentas inválidas. Corríjalas antes de guardar la plantilla."); return; }
    if (lines.length === 0) { showToast("El asiento está vacío. Añada líneas primero."); return; }

    const name = await showCustomModal('Guardar Plantilla', 'Ingrese un nombre descriptivo para esta plantilla de asiento:', 'prompt', 'Ej: Nómina mensual');
    if (!name || !name.trim()) return;

    if (templates.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        const overwrite = await showCustomModal('Plantilla duplicada', \`Ya existe una plantilla llamada "\${name.trim()}". ¿Desea guardarla de todas formas?\`, 'confirm');
        if(!overwrite) return;
    }

    const newTemplate = {
        id: Date.now().toString(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        lines: lines
    };

    templates.push(newTemplate);
    localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
    renderTemplateSelector();
    showToast("Plantilla guardada exitosamente.");
}

async function loadTemplateSelect(el) {
    const val = el.value;
    el.value = ""; 
    
    if (!val) return;
    
    if (val === '_manage') {
        manageTemplates();
        return;
    }

    const template = templates.find(t => t.id === val);
    if (!template) return;
    
    const confirmLoad = await showCustomModal('Cargar Plantilla', \`¿Cargar plantilla "\${template.name}"? Esto reemplazará las líneas actuales del voucher.\`, 'confirm');
    if (!confirmLoad) return;

    document.getElementById('lines-container').innerHTML = '';
    
    let missingAccounts = 0;
    
    template.lines.forEach(l => {
        const account = dbCatalog.find(x => x.c === l.c);
        if (account) {
            addLine(account.c, account.n, l.t);
        } else {
            missingAccounts++;
            addLine('', '', l.t);
        }
    });

    if (missingAccounts > 0) {
        showToast(\`Se cargó la plantilla, pero \${missingAccounts} cuenta(s) ya no existen en el catálogo actual.\`);
    } else {
        showToast("Plantilla aplicada con éxito.");
    }
    
    calcTotals();
}

async function manageTemplates() {
    if (templates.length === 0) { showToast("No hay plantillas guardadas."); return; }
    
    let msg = "Tus plantillas guardadas:\\n\\n";
    templates.forEach((t, i) => msg += \`\${i + 1}. \${t.name}\\n\`);
    msg += "\\nEscribe el NÚMERO de la plantilla que deseas ELIMINAR:";
    
    const res = await showCustomModal('Administrar Plantillas', msg, 'prompt', 'Ej: 1');
    if (res) {
        const idx = parseInt(res) - 1;
        if (idx >= 0 && idx < templates.length) {
            const deletedName = templates[idx].name;
            templates.splice(idx, 1);
            localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
            renderTemplateSelector();
            showToast(\`Plantilla "\${deletedName}" eliminada permanentemente.\`);
        } else {
            showToast("Número inválido.");
        }
    }
}

// --- PROCESAMIENTO CSV ---
document.getElementById('csv-input').onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;

    Papa.parse(file, {
        header: true,
        complete: (results) => {
            const cleanData = results.data.map(row => {
                const code = (row['CÓDIGO'] || row['CODIGO'] || '').toString().replace(/['\\s]/g, '').trim();
                const name = (row['NOMBRE DE CUENTA'] || row['CUENTA'] || '').toString().trim();
                return { c: code, n: name, l: code.length <= 1 ? 1 : (code.length <= 2 ? 2 : (code.length <= 4 ? 3 : 4)) };
            }).filter(x => x.c && x.n);

            if(cleanData.length > 0) {
                dbCatalog = cleanData;
                baseCatalog = [...cleanData];
                localStorage.setItem(STORAGE_BASE_CUC, JSON.stringify(baseCatalog));
                localStorage.setItem(STORAGE_CUC, JSON.stringify(dbCatalog));
                initApp();
                showToast(\`Motor activado: \${dbCatalog.length} cuentas.\`);
            } else {
                showToast("Formato no válido. Verifica las columnas.");
            }
        }
    });
};

// --- LÓGICA VOUCHER ---
function addLine(prefillCode = '', prefillName = '', prefillType = 'D', pVal = '', dVal = '', hVal = '') {
    const id = Date.now() + Math.random();
    const typeLabel = prefillType === 'H' ? 'HABER' : 'DEBE';
    const typeClass = prefillType === 'H' ? 'btn-toggle-type btn-haber' : 'btn-toggle-type btn-debe';
    
    const formatFmt = (val) => val > 0 ? parseFloat(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';

    const html = \`
        <div class="line-row" id="row-\${id}" draggable="true" data-selected-code="\${prefillCode}">
            <div class="drag-handle" title="Arrastrar para reordenar">⋮⋮</div>
            <div class="autocomplete-wrapper">
                <input type="text" class="input-code mono" placeholder="Código o Nombre..." autocomplete="off" 
                    oninput="handleSearch(this)" onkeydown="handleKeydown(event, this)" onblur="handleBlur(this)" value="\${prefillCode}">
                <div class="suggestions"></div>
            </div>
            <input type="text" class="input-name" placeholder="Cuenta..." readonly style="background:var(--bg)"
                onblur="finalizeCreation(this)" onkeydown="handleNameKeydown(event, this)" value="\${prefillName}">
            <button type="button" class="\${typeClass}" data-type="\${prefillType}" onclick="toggleType(this)">\${typeLabel}</button>
            <input type="text" class="input-parcial text-right mono" placeholder="0.00" oninput="formatCurrencyInput(this); calcTotals()" value="\${formatFmt(pVal)}">
            <input type="text" class="input-debe text-right mono" placeholder="0.00" oninput="formatCurrencyInput(this); calcTotals()" value="\${formatFmt(dVal)}">
            <input type="text" class="input-haber text-right mono" placeholder="0.00" oninput="formatCurrencyInput(this); calcTotals()" value="\${formatFmt(hVal)}">
            <button class="btn btn-danger" onclick="document.getElementById('row-\${id}').remove(); calcTotals()">✕</button>
        </div>
    \`;
    document.getElementById('lines-container').insertAdjacentHTML('beforeend', html);
}

function toggleType(btn) {
    if(btn.dataset.type === 'D') {
        btn.dataset.type = 'H';
        btn.textContent = 'HABER';
        btn.className = 'btn-toggle-type btn-haber';
    } else {
        btn.dataset.type = 'D';
        btn.textContent = 'DEBE';
        btn.className = 'btn-toggle-type btn-debe';
    }
}

function getParentCode(code) {
    if (code.length <= 1) return null; 
    if (code.length === 2) return code.substring(0, 1); 
    if (code.length === 3 || code.length === 4) return code.substring(0, 2); 
    return code.substring(0, code.length - 2); 
}
`;
fs.appendFileSync('index.html', part4);
