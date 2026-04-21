const fs = require('fs');

const part2 = `
<main>
    <!-- VISTA: LIBRO DIARIO -->
    <section id="view-diario" class="view active">
        <div class="card">
            <div class="card-header">
                <h2 id="form-title">Voucher Contable</h2>
                <div style="display:flex;gap:0.75rem;align-items:center;">
                    <!-- Selector de Plantillas -->
                    <select id="template-selector" class="btn btn-outline" style="padding:0.65rem; font-size:0.8rem; border-radius:8px; cursor:pointer;" onchange="loadTemplateSelect(this)">
                        <option value="">📁 Cargar Plantilla...</option>
                    </select>
                    
                    <!-- Botones de Exportación / Importación -->
                    <button class="btn btn-outline" onclick="exportOperationalData()" title="Exportar Backup">💾 Backup</button>
                    <button class="btn btn-outline" onclick="document.getElementById('import-backup-input').click()" title="Importar Backup">📂 Importar</button>
                    <input type="file" id="import-backup-input" accept=".json" style="display:none" onchange="handleImportBackupChange(event)">
                    
                    <button class="btn btn-outline" onclick="resetDB()">Limpiar BD</button>
                    <!-- EXPORTACIÓN UNIFICADA -->
                    <button class="btn btn-primary" onclick="exportSistemaCompleto()">⬇ Exportar Sistema Completo</button>
                </div>
            </div>
            
            <div class="entry-form" id="entry-form-container">
                <div class="entry-grid">
                    <div class="form-group">
                        <label>FECHA CONTABLE</label>
                        <input type="date" id="entry-date">
                    </div>
                    <div class="form-group">
                        <label>CONCEPTO / GLOSA GENERAL</label>
                        <input type="text" id="entry-glosa" placeholder="Descripción de la transacción...">
                    </div>
                </div>

                <div id="lines-container"></div>
                
                <div style="margin-top:1.5rem;display:flex;justify-content:space-between;align-items:center">
                    <button class="btn btn-outline" onclick="addLine()">+ Añadir Fila</button>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-outline" onclick="saveTemplate()">💾 Guardar como Plantilla</button>
                        <button class="btn btn-outline" id="btn-cancel-edit" onclick="cancelEdit()" style="display:none; color:var(--ink2);">Cancelar Edición</button>
                        <button class="btn btn-primary" id="btn-post-entry" onclick="postEntry()" style="padding:1rem 2.5rem">Postear Asiento</button>
                    </div>
                </div>

                <div class="totals-bar">
                    <div class="total-item"><label>Total Debe</label><span id="total-debe">0.00</span></div>
                    <div class="total-item"><label>Total Haber</label><span id="total-haber">0.00</span></div>
                    <div class="total-item"><label>Diferencia</label><span id="total-diff">0.00</span></div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h3>Asientos Recientes</h3></div>
            <div style="overflow-x:auto">
                <table id="journal-table">
                    <thead>
                        <tr>
                            <th style="width:100px">Fecha</th>
                            <th style="width:150px">Código</th>
                            <th>Cuenta / Glosa</th>
                            <th class="text-right">Parcial</th>
                            <th class="text-right">Debe</th>
                            <th class="text-right">Haber</th>
                        </tr>
                    </thead>
                    <tbody id="journal-tbody"></tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- VISTA: LIBRO MAYOR -->
    <section id="view-mayor" class="view">
        <div class="card" style="margin-bottom: 1rem;">
            <div class="card-header">
                <div style="display:flex;flex-direction:column;gap:5px">
                    <h2 style="font-size:1.4rem">Libro Mayor (Jerárquico)</h2>
                    <div id="mayor-acc-name" style="font-size:0.85rem; color:var(--ink3); font-weight:600;">Seleccione una cuenta del catálogo para visualizar...</div>
                </div>
                <div style="display:flex;gap:0.75rem;align-items:center;">
                    <!-- EXPORTACIÓN UNIFICADA -->
                    <button class="btn btn-primary" onclick="exportSistemaCompleto()">⬇ Exportar Sistema Completo</button>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 1.5rem; align-items: start;">
            <!-- PANEL IZQUIERDO: Árbol de Catálogo -->
            <div class="card" style="margin-bottom:0; max-height: 70vh; display: flex; flex-direction: column;">
                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                    <input type="text" id="mayor-tree-search" placeholder="Buscar cuenta o grupo (ej: 11)..." oninput="renderMayorTree()" style="width: 100%;">
                </div>
                <div id="mayor-tree-container" style="overflow-y: auto; padding: 1rem; font-size: 0.85rem; flex: 1;">
                    <!-- Árbol renderizado por JS -->
                </div>
            </div>
            
            <!-- PANEL DERECHO: Tabla del Mayor -->
            <div class="card" style="margin-bottom:0; max-height: 70vh; display: flex; flex-direction: column;">
                <div style="overflow-y:auto; flex: 1;">
                    <table id="mayor-table">
                        <thead style="position:sticky;top:0;z-index:5">
                            <tr>
                                <th style="width:120px; text-align:center;">Fecha</th>
                                <th style="width:120px; text-align:center;">Asiento</th>
                                <th>Concepto</th>
                                <th class="text-right">Débito</th>
                                <th class="text-right">Crédito</th>
                                <th class="text-right" style="background:var(--surface2)">Saldo</th>
                            </tr>
                        </thead>
                        <tbody id="mayor-tbody">
                            <tr><td colspan="6" style="text-align:center; color:var(--ink3); padding: 2rem;">Seleccione una cuenta a la izquierda para generar el libro mayor.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </section>

    <!-- VISTA: CATÁLOGO -->
    <section id="view-catalogo" class="view">
        <div class="card">
            <div class="card-header">
                <div style="display:flex;flex-direction:column;gap:5px">
                    <h2 style="font-size:1.4rem">Catálogo Único de Cuentas (CUC)</h2>
                    <div id="catalog-counter" class="stats-badge">Contando registros...</div>
                </div>
                <div style="width:400px">
                    <input type="text" id="cat-search" placeholder="Buscar por código o nombre..." oninput="renderCatalog()">
                </div>
            </div>
            <div style="max-height:70vh;overflow-y:auto">
                <table>
                    <thead style="position:sticky;top:0;z-index:5">
                        <tr>
                            <th style="width:180px">Código</th>
                            <th>Nombre de la Cuenta</th>
                            <th>Nivel</th>
                        </tr>
                    </thead>
                    <tbody id="catalog-tbody"></tbody>
                </table>
            </div>
        </div>
    </section>
</main>

<!-- MODAL PERSONALIZADO -->
<div id="custom-modal">
    <div class="modal-card">
        <h3 id="modal-title">Título</h3>
        <p id="modal-message">Mensaje</p>
        <input type="text" id="modal-input" placeholder="" autocomplete="off">
        <div class="btn-group">
            <button id="modal-cancel" class="btn btn-outline">Cancelar</button>
            <button id="modal-confirm" class="btn btn-primary">Aceptar</button>
        </div>
    </div>
</div>

<div id="toast">Notificación</div>

`;
fs.appendFileSync('index.html', part2);
