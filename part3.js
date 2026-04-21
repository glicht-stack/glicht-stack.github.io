const fs = require('fs');

const part3 = `
<script>
/**
 * MOTOR SISBANK PRO - RECONSTRUIDO CON EXPORTACIÓN UNIFICADA Y MAYOR JERÁRQUICO
 */
let baseCatalog = []; 
let dbCatalog = [];   
let journal = [];
let templates = [];
let editingEntryId = null; 

// Variables para Libro Mayor
let currentMayorCode = '';
let currentMayorName = '';
let expandedNodes = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']); // Expandimos los Elementos base por defecto

const STORAGE_BASE_CUC = 'sisbank_base_cuc_db'; 
const STORAGE_CUC = 'sisbank_cuc_db';
const STORAGE_JOURNAL = 'sisbank_journal_db';
const STORAGE_TEMPLATES = 'sisbank_templates_db';

// --- UTILIDADES DE FORMATEO (UX) ---
function parseCurrency(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/,/g, '')) || 0;
}

function formatCurrencyInput(input) {
    let cursorPosition = input.selectionStart;
    const originalLength = input.value.length;

    let rawValue = input.value.replace(/[^0-9.]/g, '');
    
    const parts = rawValue.split('.');
    if (parts.length > 2) {
        rawValue = parts[0] + '.' + parts.slice(1).join('');
    }

    const splitValue = rawValue.split('.');
    let intPart = splitValue[0];
    const decPart = splitValue.length > 1 ? '.' + splitValue[1] : '';

    if (intPart) {
        intPart = intPart.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
    }

    const formattedValue = intPart + decPart;
    input.value = formattedValue;

    cursorPosition += (formattedValue.length - originalLength);
    input.setSelectionRange(cursorPosition, cursorPosition);
}

// --- INICIO ---
window.onload = () => {
    const storedBase = localStorage.getItem(STORAGE_BASE_CUC);
    const storedCUC = localStorage.getItem(STORAGE_CUC);
    const storedJournal = localStorage.getItem(STORAGE_JOURNAL);
    const storedTemplates = localStorage.getItem(STORAGE_TEMPLATES);

    if(storedJournal) journal = JSON.parse(storedJournal);
    if(storedTemplates) templates = JSON.parse(storedTemplates);

    if(storedCUC) {
        dbCatalog = JSON.parse(storedCUC);
        
        if (storedBase) {
            baseCatalog = JSON.parse(storedBase);
        } else {
            baseCatalog = [...dbCatalog];
            localStorage.setItem(STORAGE_BASE_CUC, JSON.stringify(baseCatalog));
        }

        initApp();
    } else {
        document.getElementById('setup-overlay').style.display = 'flex';
    }
    
    initDragAndDrop();
};

function initApp() {
    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('db-status').textContent = \`DB: \${dbCatalog.length} registros\`;
    
    cancelEdit(false); 
    
    renderTemplateSelector(); 
    renderJournal();
    renderCatalog(); 
    renderMayorTree(); // Renderizamos el árbol del Mayor de inmediato
}

// --- LÓGICA DE BACKUPS OPERATIVOS (EXPORTAR/IMPORTAR) ---
async function exportOperationalData() {
    if (journal.length === 0 && templates.length === 0) {
        showToast("No hay asientos ni plantillas operativas para exportar.");
        return;
    }

    const cuentas_nuevas = dbCatalog.filter(c => !baseCatalog.some(b => b.c === c.c));
    
    const data = {
        asientos: journal,
        plantillas: templates,
        cuentas_nuevas: cuentas_nuevas,
        metadata: {
            fecha_exportacion: new Date().toISOString(),
            version: "1.0",
            requiere_catalogo: true
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    saveAs(blob, \`backup_operativo_\${Date.now()}.json\`);
    showToast("Datos operativos exportados correctamente.");
}

async function handleImportBackupChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            await importOperationalData(data);
        } catch (err) {
            showCustomModal('Error de Lectura', 'Archivo inválido', 'alert');
        }
        e.target.value = ''; 
    };
    reader.readAsText(file);
}

async function importOperationalData(data) {
    if (!baseCatalog || baseCatalog.length === 0) {
        showCustomModal('Error Crítico', 'Debe cargar un catálogo de cuentas antes de importar datos', 'alert');
        return;
    }

    if (!data.asientos || !data.plantillas || !data.cuentas_nuevas || !data.metadata) {
        showCustomModal('Estructura Inválida', 'Archivo inválido', 'alert');
        return;
    }

    const confirmMsg = '¿Está seguro de importar este backup? Esto reemplazará TODOS los asientos, plantillas y cuentas creadas manualmente. (El catálogo base se mantendrá intacto).';
    const confirm = await showCustomModal('Importar Backup', confirmMsg, 'confirm');
    if (!confirm) return;

    const combinedCatalog = [...baseCatalog, ...data.cuentas_nuevas];
    const catalogCodes = new Set(combinedCatalog.map(c => c.c));

    let allValid = true;
    
    for (let newAcc of data.cuentas_nuevas) {
        const parentCode = getParentCode(newAcc.c);
        if (parentCode !== null && !catalogCodes.has(parentCode)) {
            allValid = false;
            break;
        }
    }

    const checkLines = (lines) => {
        for (let l of lines) {
            if (!catalogCodes.has(l.c)) return false;
        }
        return true;
    };

    if (allValid) {
        for (let a of data.asientos) { if (!checkLines(a.lines)) { allValid = false; break; } }
    }
    if (allValid) {
        for (let t of data.plantillas) { if (!checkLines(t.lines)) { allValid = false; break; } }
    }

    if (!allValid) {
        showCustomModal('Error de Consistencia', 'Existen cuentas que no están en el catálogo ni en las cuentas nuevas', 'alert');
        return;
    }

    dbCatalog = combinedCatalog;
    journal = data.asientos;
    templates = data.plantillas;

    localStorage.setItem(STORAGE_CUC, JSON.stringify(dbCatalog));
    localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(journal));
    localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));

    initApp(); 
    showToast('Datos operativos cargados correctamente.');
}

// --- LÓGICA DE PLANTILLAS DE ASIENTOS ---
function renderTemplateSelector() {
    const selector = document.getElementById('template-selector');
    if(!selector) return;
    
    let html = '<option value="">📁 Cargar Plantilla...</option>';
    templates.forEach(t => {
        html += \`<option value="\${t.id}">\${t.name}</option>\`;
    });
    
    if (templates.length > 0) {
        html += \`<option disabled>──────────────</option>\`;
        html += \`<option value="_manage">⚙️ Administrar Plantillas...</option>\`;
    }
    
    selector.innerHTML = html;
}

// SISTEMA DE MODALES PERSONALIZADOS (Reemplazo de alert, prompt, confirm)
function showCustomModal(title, msg, type = 'alert', placeholder = '') {
    return new Promise(resolve => {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = msg;
        
        const input = document.getElementById('modal-input');
        const btnCancel = document.getElementById('modal-cancel');
        const btnConfirm = document.getElementById('modal-confirm');
        
        if (type === 'prompt') {
            input.style.display = 'block';
            input.value = '';
            input.placeholder = placeholder;
        } else {
            input.style.display = 'none';
        }
        
        btnCancel.style.display = (type !== 'alert') ? 'block' : 'none';
        
        m.style.display = 'flex';
        if(type === 'prompt') setTimeout(() => input.focus(), 100);

        btnCancel.onclick = () => { m.style.display = 'none'; resolve(null); };
        btnConfirm.onclick = () => { 
            m.style.display = 'none'; 
            resolve(type === 'prompt' ? input.value : true); 
        };
    });
}
`;
fs.appendFileSync('index.html', part3);
