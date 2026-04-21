const fs = require('fs');

const part5 = `
function handleSearch(el) {
    const query = el.value.trim().toLowerCase();
    const suggest = el.nextElementSibling;
    const row = el.closest('.line-row');

    if ((row.dataset.selectedCode && row.dataset.selectedCode !== el.value.trim()) || row.dataset.creatingCode) {
        row.dataset.selectedCode = "";
        delete row.dataset.creatingCode;
        
        const nameInput = row.querySelector('.input-name');
        nameInput.value = "";
        nameInput.readOnly = true;
        nameInput.classList.remove('creating-mode');
        nameInput.placeholder = "Cuenta...";
        el.classList.remove('error');
    }

    if(!query) { suggest.style.display = 'none'; return; }

    const rowId = row.id;

    const matches = dbCatalog
        .filter(x => x.c.includes(query) || x.n.toLowerCase().includes(query))
        .sort((a, b) => {
            const aStart = a.c.startsWith(query);
            const bStart = b.c.startsWith(query);
            if (aStart && !bStart) return -1;
            if (!aStart && bStart) return 1;
            return a.c.localeCompare(b.c);
        })
        .slice(0, 15);

    let html = matches.map(m => \`
        <div class="suggestion-item" onclick="selectAcc('\${rowId}', '\${m.c}', '\${m.n.replace(/'/g, "")}')">
            <div style="font-weight:600; color:var(--accent); font-family:'JetBrains Mono'; font-size:0.85rem">\${m.c}</div>
            <div style="font-size:0.75rem; color:var(--ink2)">\${m.n}</div>
        </div>
    \`).join('');

    const exactMatch = dbCatalog.find(x => x.c === query || x.n.toLowerCase() === query);
    if (!exactMatch && /^\\d+$/.test(query)) {
        html += \`
            <div class="suggestion-item btn-create-acc" onclick="activateCreationMode('\${rowId}', '\${query}')">
                + Crear cuenta "\${query}" (Presione Enter)
            </div>
        \`;
    }

    if(html) {
        suggest.innerHTML = html;
        suggest.style.display = 'block';
    } else {
        suggest.style.display = 'none';
    }
}

function handleKeydown(e, el) {
    const suggest = el.nextElementSibling;
    if (suggest.style.display === 'none') {
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur(); 
        }
        return;
    }

    const items = suggest.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    let activeIdx = Array.from(items).findIndex(item => item.classList.contains('active-suggestion'));

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIdx >= 0) items[activeIdx].classList.remove('active-suggestion');
        activeIdx = (activeIdx + 1) % items.length;
        items[activeIdx].classList.add('active-suggestion');
        items[activeIdx].scrollIntoView({block: "nearest"});
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIdx >= 0) items[activeIdx].classList.remove('active-suggestion');
        activeIdx = (activeIdx - 1 + items.length) % items.length;
        items[activeIdx].classList.add('active-suggestion');
        items[activeIdx].scrollIntoView({block: "nearest"});
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0) {
            items[activeIdx].click(); 
        } else {
            el.blur(); 
        }
    }
}

function handleBlur(el) {
    setTimeout(() => {
        const query = el.value.trim();
        const row = el.closest('.line-row');
        const suggest = el.nextElementSibling;
        suggest.style.display = 'none';

        if (row.dataset.creatingCode) return; 

        if (!query) {
            row.dataset.selectedCode = "";
            row.querySelector('.input-name').value = "";
            el.classList.remove('error');
            return;
        }

        if (row.dataset.selectedCode && row.dataset.selectedCode === query) {
            el.classList.remove('error');
            return;
        }

        const queryLower = query.toLowerCase();
        
        const exactCode = dbCatalog.filter(x => x.c.toLowerCase() === queryLower);
        if (exactCode.length === 1) {
            selectAcc(row.id, exactCode[0].c, exactCode[0].n);
            return;
        }

        const exactName = dbCatalog.filter(x => x.n.toLowerCase() === queryLower);
        if (exactName.length === 1) {
            selectAcc(row.id, exactName[0].c, exactName[0].n);
            return;
        }

        if (/^\\d+$/.test(query)) {
            activateCreationMode(row.id, query);
            return;
        }

        showToast("Debe seleccionar una cuenta válida del listado.");
        el.classList.add('error');
        el.value = "";
        row.querySelector('.input-name').value = "";
        row.dataset.selectedCode = "";
        
    }, 150); 
}

function activateCreationMode(rowId, query) {
    const row = document.getElementById(rowId);
    const inputCode = row.querySelector('.input-code');
    const inputName = row.querySelector('.input-name');

    const parentCode = getParentCode(query);
    if (parentCode !== null && !dbCatalog.some(x => x.c === parentCode)) {
        showToast(\`No se puede crear: No existe la cuenta padre (\${parentCode})\`);
        inputCode.classList.add('error');
        row.dataset.selectedCode = "";
        return; 
    }

    row.dataset.creatingCode = query;
    inputCode.value = query;
    inputCode.classList.remove('error');
    
    inputName.readOnly = false;
    inputName.value = "";
    inputName.placeholder = "Ingrese el nombre de la nueva cuenta...";
    inputName.classList.add('creating-mode');
    
    setTimeout(() => inputName.focus(), 50);
}

function handleNameKeydown(e, el) {
    if (e.key === 'Enter') {
        e.preventDefault();
        el.blur(); 
    }
}

function finalizeCreation(el) {
    const row = el.closest('.line-row');
    if (!row.dataset.creatingCode) return; 

    const code = row.dataset.creatingCode;
    const name = el.value.trim(); 

    el.readOnly = true;
    el.classList.remove('creating-mode');
    el.placeholder = "Cuenta...";

    if (!name) {
        showToast("Creación cancelada: Nombre vacío.");
        row.querySelector('.input-code').value = "";
        row.querySelector('.input-code').classList.add('error');
        delete row.dataset.creatingCode;
        return;
    }

    const newAcc = { 
        c: code, 
        n: name, 
        l: code.length <= 1 ? 1 : (code.length <= 2 ? 2 : (code.length <= 4 ? 3 : 4)) 
    };
    
    if(!dbCatalog.some(x => x.c === newAcc.c)) {
        dbCatalog.push(newAcc);
        localStorage.setItem(STORAGE_CUC, JSON.stringify(dbCatalog));
        document.getElementById('db-status').textContent = \`DB: \${dbCatalog.length} registros\`;
        showToast("Cuenta creada y asociada correctamente.");
        renderMayorTree(); // Refrescar el árbol visual si se crea una cuenta
    }

    selectAcc(row.id, code, name);
}

function selectAcc(rowId, code, name) {
    const row = document.getElementById(rowId);
    const inputCode = row.querySelector('.input-code');
    const inputName = row.querySelector('.input-name');
    
    inputCode.value = code;
    inputCode.classList.remove('error');
    
    inputName.value = name;
    inputName.readOnly = true;
    inputName.classList.remove('creating-mode');
    inputName.placeholder = "Cuenta...";
    
    delete row.dataset.creatingCode;
    row.dataset.selectedCode = code; 
    row.querySelector('.suggestions').style.display = 'none';
}

function calcTotals() {
    let d = 0, h = 0;
    document.querySelectorAll('.input-debe').forEach(el => d += parseCurrency(el.value));
    document.querySelectorAll('.input-haber').forEach(el => h += parseCurrency(el.value));
    
    document.getElementById('total-debe').textContent = d.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('total-haber').textContent = h.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const diff = Math.abs(d - h);
    document.getElementById('total-diff').textContent = diff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('total-diff').style.color = diff < 0.01 ? 'var(--green)' : 'var(--red)';
}

`;
fs.appendFileSync('index.html', part5);
