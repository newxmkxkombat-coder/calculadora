import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.options(/(.*)/, cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- VARIABLES GLOBALES DE SESIÓN ---
let globalBrowser = null;
let globalPage = null; // Mantiene la pestaña abierta siempre
let sessionActive = false;
let lastInteraction = 0;

// Configuración URL
const TARGET_URL = 'https://gps3regisdataweb.com/opita/index.jsp';

// --- INICIALIZACIÓN DEL NAVEGADOR (Solo una vez) ---
const initBrowser = async () => {
    if (!globalBrowser) {
        console.log('Lanzando navegador global...');
        globalBrowser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
                '--single-process', '--disable-gpu', '--disable-extensions'
            ]
        });

        globalPage = await globalBrowser.newPage();
        await globalPage.setViewport({ width: 1366, height: 768 });

        // Bloqueo de recursos para velocidad
        await globalPage.setRequestInterception(true);
        globalPage.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log('Navegador listo.');
    }
    return globalPage;
};

// --- FUNCIÓN DE LOGIN INTELIGENTE ---
// Verifica si estamos logueados, si no, se loguea.
const ensureLoggedIn = async (page, username, password) => {
    try {
        // Verificar dónde estamos
        const currentUrl = page.url();
        const content = await page.content();

        // Si vemos el input de usuario, NO estamos logueados
        const isLoginPage = content.includes('input type="text"') && content.includes('input type="password"');

        if (isLoginPage || !currentUrl.includes('opita') || !sessionActive) {
            console.log('Sesión no detectada o expirada. Logueándose...');
            await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });

            await page.waitForSelector('input[type="text"]', { visible: true, timeout: 20000 });
            await page.waitForSelector('input[type="password"]', { visible: true, timeout: 20000 });

            await page.type('input[type="text"]', username, { delay: 50 });
            await page.type('input[type="password"]', password, { delay: 50 });

            // Buscar botón ingresar (puede variar)
            const loginClicked = await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button, input[type="submit"], a')).find(e =>
                    (e.innerText || e.value || '').toLowerCase().includes('ingresar')
                );
                if (btn) { btn.click(); return true; }
                return false;
            });

            if (!loginClicked) await page.keyboard.press('Enter');

            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            sessionActive = true;
            console.log('Login exitoso.');
        } else {
            console.log('Sesión activa detectada. Reutilizando...');
        }
        lastInteraction = Date.now();
    } catch (e) {
        console.error("Error en login:", e.message);
        sessionActive = false; // Forzar re-login la próxima
        throw e;
    }
};

// --- ROUTA PRINCIPAL ---
app.post('/api/scrape-passengers', async (req, res) => {
    const { username, password } = req.body;

    try {
        const page = await initBrowser();

        // 1. Asegurar sesión
        await ensureLoggedIn(page, username, password);

        // 2. Navegar a "Móviles" específicamente (Lo que pidió el usuario)
        console.log('Navegando a reporte de Móviles...');

        // Verificar si ya estamos en un reporte para no recargar a lo loco
        // Pero el usuario dice que hay que "buscar" cada vez.

        // Intentar encontrar el menú "Móviles" o "Reportes -> Móviles"
        await page.evaluate(async () => {
            // Buscar link directo "Móviles" o "Moviles"
            const links = Array.from(document.querySelectorAll('a, span, div, li'));

            // Prioridad: "Móviles" en el menú principal
            let target = links.find(el => {
                const t = (el.innerText || '').toLowerCase().trim();
                return t === 'móviles' || t === 'moviles' || t === 'reporte móviles';
            });

            if (target) {
                target.click();
            } else {
                // Si no, buscar "Reportes" y luego "Móviles"
                const reportes = links.find(el => (el.innerText || '').toLowerCase().trim() === 'reportes');
                if (reportes) {
                    reportes.click();
                    // Esperar un poquito (esto es dentro del browser context es dificil, pero el click desencadena eventos)
                }
            }
        });

        // Esperamos un momento para que la UI reaccione
        await new Promise(r => setTimeout(r, 2000));

        // Ahora buscar sub-opción si estábamos en reportes
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, span, div, li'));
            const target = links.find(el => {
                const t = (el.innerText || '').toLowerCase();
                return (t.includes('móviles') || t.includes('moviles')) && el.offsetParent !== null;
            });
            if (target) target.click();
        });

        // 3. Buscar y Clickear botón "Generar" o "Buscar" para actualizar datos
        console.log('Actualizando datos...');
        await new Promise(r => setTimeout(r, 1000));

        const searchClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, div.btn'));
            const goBtn = btns.find(b =>
                ['generar', 'buscar', 'consultar', 'ver', 'refresh'].some(k => (b.innerText || b.value || '').toLowerCase().includes(k))
            );
            if (goBtn) { goBtn.click(); return true; }
            return false;
        });

        if (searchClicked) {
            // Esperar carga de datos (AJAX) - Si la sesión está viva es rápido
            await new Promise(r => setTimeout(r, 4000));
        }

        // 4. Extracción Específica (Interno - Total Día)
        console.log('Extrayendo datos de Móviles...');

        const vehicles = await page.evaluate(() => {
            const results = [];

            // Buscar tablas en todos los frames
            const frames = [document, ...Array.from(window.frames).map(f => { try { return f.document; } catch (e) { return null; } }).filter(d => d)];

            for (const doc of frames) {
                const tables = Array.from(doc.querySelectorAll('table'));
                for (const table of tables) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length < 2) continue;

                    // Identificar columnas
                    let colInterno = -1;
                    let colTotal = -1;

                    // Header heurística
                    // Buscamos en las primeras filas
                    for (let i = 0; i < Math.min(rows.length, 5); i++) {
                        const cells = Array.from(rows[i].querySelectorAll('td, th'));
                        const txts = cells.map(c => c.innerText.toLowerCase().trim());

                        colInterno = txts.findIndex(t => t.includes('interno') || t.includes('unidad') || t.includes('móvil') || t === 'movil');
                        colTotal = txts.findIndex(t => t.includes('total día') || t.includes('total dia') || t === 'total' || t.includes('pax'));

                        if (colInterno !== -1 && colTotal !== -1) break;
                    }

                    // Si encontramos columnas específicas
                    if (colInterno !== -1 && colTotal !== -1) {
                        for (const row of rows) {
                            const cells = Array.from(row.querySelectorAll('td'));
                            if (!cells[colInterno] || !cells[colTotal]) continue;

                            const interno = cells[colInterno].innerText.trim().replace(/^0+/, '');
                            const total = cells[colTotal].innerText.trim();

                            // Validación básica
                            if (/^\d+$/.test(interno) && /^\d+$/.test(total)) {
                                if (!results.find(v => v.identifier === interno)) {
                                    results.push({ identifier: interno, pasajeros: total });
                                }
                            }
                        }
                    } else {
                        // Fallback posicional si falla header (usualmente Interno es col 0 o 1, Total col 8 o ultima)
                        // Heurística cruda para tablas de datos
                        for (const row of rows) {
                            const cells = Array.from(row.querySelectorAll('td'));
                            if (cells.length < 5) continue;

                            // Asumimos col 0 o 1 es ID, col con numero > 0 y < 2000 es pasajero
                            // Intentamos encontrar patron ID... Pasajero
                            const txts = cells.map(c => c.innerText.trim());

                            // ID debe ser numero corto (1-4 digitos)
                            const possibleIdIdx = txts.findIndex(t => /^\d{1,4}$/.test(t) && !t.includes(':') && !t.includes('-'));
                            if (possibleIdIdx !== -1) {
                                // Buscar pasajero después del ID
                                for (let k = possibleIdIdx + 1; k < txts.length; k++) {
                                    const val = parseInt(txts[k]);
                                    if (!isNaN(val) && val >= 0 && val < 2000 && !txts[k].includes(':')) { // Evitar horas
                                        const id = txts[possibleIdIdx].replace(/^0+/, '');
                                        if (!results.find(v => v.identifier === id)) {
                                            results.push({ identifier: id, pasajeros: val.toString() });
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return results;
        });

        if (vehicles.length > 0) {
            console.log(`Éxito. ${vehicles.length} móviles encontrados.`);
            res.json({ success: true, vehicles });
        } else {
            // Fallback Plan C: Regex texto crudo buscando "Interno... Total"
            // A veces la tabla es div-based
            console.log("Tablas vacías, intentando regex global...");
            const rawBody = await page.evaluate(() => document.body.innerText);
            // Patron: Algo que parece Interno numero ... numero (pasajeros)
            // Asumimos que están en la misma linea o bloque cercano
            const matches = [...rawBody.matchAll(/(\d{1,4})\s+.*?(\d{1,4})/g)];
            // Esto es arriesgado, probemos algo mas seguro
            throw new Error("No se pudieron extraer datos consistentes (Columna Interno/Total no hallada).");
        }

    } catch (error) {
        console.error('Error Robot:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mantener vivo el servidor
setInterval(() => {
    if (globalPage && sessionActive) {
        console.log("Keep-alive: Chequeando sesión...");
        // Opcional: recargar ligeramente o interactuar para que no muera la sesión web
        globalPage.evaluate(() => { window.scrollBy(0, 10); }).catch(() => sessionActive = false);
    }
}, 60000 * 5); // Cada 5 mins

app.listen(PORT, () => {
    console.log(`Robot Persistente V3 escuchando en ${PORT}`);
    initBrowser(); // Arrancar browser al inicio
});
