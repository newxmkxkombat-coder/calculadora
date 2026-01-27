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

        // 4. Extracción Específica (Estricta - Interno vs Total Día)
        console.log('Extrayendo datos de Móviles...');

        const vehicles = await page.evaluate(() => {
            const results = [];
            const clean = (t) => (t || '').toLowerCase().trim();
            const cleanNum = (t) => (t || '').replace(/\D/g, '');

            const frames = [document, ...Array.from(window.frames).map(f => {
                try { return f.document; } catch (e) { return null; }
            }).filter(d => d)];

            for (const doc of frames) {
                const tables = Array.from(doc.querySelectorAll('table'));
                for (const table of tables) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length < 2) continue;

                    let colInterno = -1;
                    let colTotal = -1;
                    let headerRow = -1;

                    // 1. Buscar cabeceras exactas
                    for (let i = 0; i < Math.min(rows.length, 8); i++) {
                        const cells = Array.from(rows[i].querySelectorAll('td, th'));
                        const texts = cells.map(c => clean(c.innerText));

                        // Indices
                        const iInt = texts.findIndex(t => t.includes('número interno') || t.includes('numero interno'));
                        const iTot = texts.findIndex(t => t.includes('total día') || t.includes('total dia'));

                        if (iInt !== -1 && iTot !== -1) {
                            colInterno = iInt;
                            colTotal = iTot;
                            headerRow = i;
                            break;
                        }
                    }

                    // 2. Extraer datos alineados
                    if (headerRow !== -1) {
                        for (let j = headerRow + 1; j < rows.length; j++) {
                            const cells = Array.from(rows[j].querySelectorAll('td'));

                            // Asegurar que la fila tiene las columnas necesarias
                            if (cells[colInterno] && cells[colTotal]) {
                                // Limpieza específica: "N015" -> "15"
                                let idRaw = cells[colInterno].innerText.trim();
                                let id = idRaw.replace(/^[a-zA-Z]+0*/, '').replace(/^0+/, ''); // Quita letras iniciales y ceros izq

                                let paxRaw = cells[colTotal].innerText.trim();
                                let pax = cleanNum(paxRaw);

                                if (id && pax !== '' && !isNaN(pax)) {
                                    if (!results.find(v => v.identifier === id)) {
                                        results.push({ identifier: id, pasajeros: pax });
                                    }
                                }
                            }
                        }
                        if (results.length > 0) return results;
                    }
                }
            }
            return results;
        });

        if (vehicles.length > 0) {
            console.log(`Éxito. ${vehicles.length} móviles encontrados.`);
            res.json({ success: true, vehicles });
        } else {
            // Debug: Mostrar qué ve el robot si falla
            const layoutDump = await page.evaluate(() => {
                const tables = Array.from(document.querySelectorAll('table'));
                return tables.map(t => t.innerText.substring(0, 100).replace(/\n/g, ' ')).join(' || ');
            });
            throw new Error(`No se encontrar columnas de 'Número Interno' y 'Total día'. Tablas detectadas: ${layoutDump} ...`);
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
