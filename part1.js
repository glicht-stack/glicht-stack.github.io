const fs = require('fs');

const part1 = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SisBank — Contabilidad Bancaria</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<!-- Librerías de procesamiento -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0f1117;--ink2:#3a3d4a;--ink3:#6b7280;
  --bg:#f7f8fa;--surface:#ffffff;--surface2:#f0f2f5;
  --accent:#1a56db;--accent2:#0e3fa3;--accent-pale:#e8effe;
  --green:#0d7a4e;--green-pale:#e6f5ee;
  --red:#c0392b;--red-pale:#fdf0ef;
  --border:#e2e5ec;--border2:#cbd5e1;--radius:12px;
}

body{font-family:'Sora',sans-serif;background:var(--bg);color:var(--ink);overflow-x:hidden}

/* --- SETUP OVERLAY --- */
#setup-overlay {
  position:fixed;inset:0;background:rgba(15,17,23,0.95);
  display:flex;justify-content:center;align-items:center;z-index:9999;backdrop-filter:blur(10px);
}
.setup-card {
  background:white;padding:3rem;border-radius:24px;max-width:500px;width:90%;text-align:center;
  box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);
}
.upload-zone {
  border:2px dashed var(--border2);padding:3rem;border-radius:16px;margin:2rem 0;
  cursor:pointer;transition:0.3s;background:var(--bg);
}
.upload-zone:hover {border-color:var(--accent);background:var(--accent-pale)}

/* --- HEADER & NAV --- */
header{background:var(--ink);color:white;padding:1.2rem 2.5rem;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}
.logo{font-weight:700;font-size:1.4rem;letter-spacing:-0.5px}
.logo span{color:var(--accent)}

nav{display:flex;gap:0.5rem;background:rgba(255,255,255,0.05);padding:0.4rem;border-radius:14px}
nav button{background:transparent;border:none;color:var(--ink3);padding:0.6rem 1.2rem;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;transition:0.2s}
nav button:hover{color:white}
nav button.active{background:var(--accent);color:white}

/* --- MAIN --- */
main{max-width:1400px;margin:2rem auto;padding:0 1.5rem}
.view{display:none}
.view.active{display:block;animation:viewFade 0.4s ease}
@keyframes viewFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

.card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:2rem;overflow:hidden}
.card-header{padding:1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}

/* --- FORMULARIO DIARIO --- */
.entry-form{padding:1.5rem;background:var(--surface2)}
.entry-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-bottom:1.5rem}
.form-group label{display:block;font-size:0.75rem;font-weight:700;margin-bottom:0.5rem;color:var(--ink2)}

/* Se ajustaron las columnas de la fila para hacer espacio al botón de arrastre (drag-handle) */
.line-row{display:grid;grid-template-columns:24px 160px 1fr 70px 120px 120px 120px 45px;gap:10px;margin-bottom:10px;align-items:start; border-radius:8px; transition: background 0.2s, box-shadow 0.2s;}
.line-row.dragging{opacity:0.6; background:var(--surface2); border: 1px dashed var(--accent); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 50;}
.drag-handle{cursor:grab; display:flex; align-items:center; justify-content:center; color:var(--border2); font-size:1.2rem; height:45px; user-select:none; transition:0.2s;}
.drag-handle:hover{color:var(--accent);}
.drag-handle:active{cursor:grabbing;}

.btn-toggle-type{padding:0.75rem 0.5rem;border-radius:8px;font-weight:700;font-size:0.7rem;border:none;cursor:pointer;transition:0.2s;width:100%}
.btn-debe{background:var(--accent-pale);color:var(--accent);}
.btn-haber{background:var(--ink2);color:white;}
.autocomplete-wrapper{position:relative}
.suggestions{position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.1);max-height:220px;overflow-y:auto;z-index:100;display:none}
.suggestion-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--bg);font-size:0.8rem; line-height: 1.2;}
.suggestion-item:hover, .suggestion-item.active-suggestion {background:var(--accent-pale); border-left: 3px solid var(--accent);}
.btn-create-acc{background:var(--green-pale); color:var(--green); font-weight:700; text-align:center; padding:12px; border-top:1px solid var(--border)}

input,select{width:100%;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:0.9rem;transition: 0.2s;}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-pale)}
input.error{border-color:var(--red); box-shadow:0 0 0 4px var(--red-pale);}

/* Estilo para creación de cuenta inline */
input.creating-mode {
    background: #ffffff !important;
    border-color: var(--green);
    box-shadow: 0 0 0 4px var(--green-pale);
    color: var(--green);
    font-weight: 600;
}
input.creating-mode::placeholder { color: #86efac; font-weight: 400; }

/* Estilo visual para la columna "Parcial" */
.input-parcial { font-style: italic; }

/* Estilo para el modo edición activo */
.editing-mode-active {
    border: 2px dashed var(--accent) !important;
    background: #fdfeff !important;
}

.mono{font-family:'JetBrains Mono',monospace;font-size:0.85rem}
.text-right{text-align:right}

/* --- ESTILOS DE ÁRBOL DEL MAYOR --- */
.tree-item { user-select: none; }
.hover-bg:hover { background: var(--surface2) !important; }

/* --- BUTTONS --- */
.btn{padding:0.75rem 1.5rem;border-radius:10px;font-weight:600;cursor:pointer;transition:0.2s;font-family:inherit;border:none;display:inline-flex;align-items:center;gap:8px}
.btn-primary{background:var(--accent);color:white}
.btn-primary:hover{background:var(--accent2)}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--ink2)}
.btn-outline:hover{background:var(--surface2)}
.btn-danger{color:var(--red);background:var(--red-pale)}

/* --- TABLAS --- */
table{width:100%;border-collapse:collapse}
th{padding:1rem;background:var(--bg);font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);border-bottom:2px solid var(--border)}
td{padding:1rem;border-bottom:1px solid var(--border);font-size:0.9rem}

/* --- TOTALS BAR --- */
.totals-bar{display:flex;gap:2rem;background:var(--ink);color:white;padding:1.2rem 2rem;border-radius:16px;margin-top:1.5rem;justify-content:flex-end}
.total-item{display:flex;flex-direction:column;align-items:flex-end}
.total-item label{font-size:0.65rem;color:var(--ink3);text-transform:uppercase;font-weight:700}
.total-item span{font-family:'JetBrains Mono';font-size:1.2rem}

/* --- PRUEBA DE VIDA CATÁLOGO --- */
.stats-badge {
    background: var(--accent-pale); color: var(--accent); padding: 6px 16px;
    border-radius: 50px; font-weight: 700; font-size: 0.8rem; border: 1px solid var(--accent);
}

#toast{position:fixed;bottom:2rem;right:2rem;background:var(--ink);color:white;padding:1rem 2rem;border-radius:12px;transform:translateY(100px);opacity:0;transition:0.3s;z-index:9999}
#toast.show{transform:translateY(0);opacity:1}

/* --- CUSTOM MODAL --- */
#custom-modal {
    position: fixed; inset: 0; background: rgba(15, 17, 23, 0.85); z-index: 10000;
    display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px);
}
.modal-card {
    background: white; width: 90%; max-width: 400px; border-radius: 16px;
    padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    animation: viewFade 0.3s ease;
}
.modal-card h3 { margin-bottom: 1rem; color: var(--ink); }
.modal-card p { color: var(--ink2); font-size: 0.9rem; margin-bottom: 1.5rem; white-space: pre-wrap; }
.modal-card input { width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1.5rem; }
.modal-card .btn-group { display: flex; justify-content: flex-end; gap: 10px; }
</style>
</head>
<body>

<!-- OVERLAY DE CARGA SI NO HAY STORAGE -->
<div id="setup-overlay" style="display:none">
    <div class="setup-card">
        <h2 style="font-size:2rem;letter-spacing:-1px">Inicializar Motor CUC</h2>
        <p style="color:var(--ink3);margin:1rem 0">Sube el archivo CSV con el catálogo bancario oficial para comenzar.</p>
        <input type="file" id="csv-input" accept=".csv" style="display:none">
        <div class="upload-zone" onclick="document.getElementById('csv-input').click()">
            <div style="font-size:3rem">📂</div>
            <p>Haz clic para seleccionar el archivo</p>
            <span style="font-size:0.7rem;color:var(--ink3)">(Columnas requeridas: CÓDIGO, NOMBRE DE CUENTA)</span>
        </div>
    </div>
</div>

<header>
    <div class="logo">SisBank<span>PRO</span></div>
    <div style="display:flex;align-items:center;gap:2rem">
        <div id="db-status" style="font-size:0.7rem;font-weight:700;background:rgba(255,255,255,0.1);padding:0.4rem 1rem;border-radius:20px">Iniciando...</div>
        <nav>
            <button onclick="navigate('diario')" id="nav-diario" class="active">Libro Diario</button>
            <button onclick="navigate('mayor')" id="nav-mayor">Libro Mayor</button>
            <button onclick="navigate('catalogo')" id="nav-catalogo">Catálogo</button>
        </nav>
    </div>
</header>
`;
fs.writeFileSync('index.html', part1);
