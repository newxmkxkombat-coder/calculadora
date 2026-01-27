import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));
app.options(/(.*)/, cors());
app.options('/api/scrape-passengers', cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- OPTIMIZACIÓN GLOBAL: Instancia única del navegador ---
let globalBrowser;

const initBrowser = async () => {
    if (!globalBrowser) {
        console.log('Lanzando navegador global...');
        globalBrowser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-extensions' // Desactivar extensiones
            ]
        });
        console.log('Navegador global listo.');
    }
    return globalBrowser;
};

// Inicializar al arrancar
initBrowser();

app.post('/api/scrape-passengers', async (req, res) => {
    const { username, password } = req.body;
    const TARGET_URL = 'https://gps3regisdataweb.com/opita/index.jsp';
    let page = null;

    try {
        const browser = await initBrowser();
        page = await browser.newPage();

        // --- OPTIMIZACIÓN: Bloqueo de recursos innecesarios ---
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Configurar vista ligera
        await page.setViewport({ width: 1280, height: 720 });

        // 1. Ir al Login (Timeout reducido)
        console.log('Navegando a login...');
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 2. Llenar credenciales (Espera inteligente)
        await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        await page.type('input[type="text"]', username);
        await page.type('input[type="password"]', password);

        // 3. Click Ingresar
        const loginBtn = await page.$('button, input[type="submit"], input[type="button"], a.btn');
        if (loginBtn) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
                loginBtn.click()
            ]);
        } else {
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });
        }

        // 4. Navegación Inteligente (Optimizada)
        console.log('Buscando ruta a datos...');

        // Esperar que aparezca algo que parezca un menú o enlace
        await page.waitForFunction(() => document.querySelectorAll('a, span, div').length > 10, { timeout: 10000 });

        // Intentar encontrar reporte directamente o menú
        const found = await page.evaluate(async () => {
            const keywords = ['producción por vehículo', 'produccion', 'vehículo', 'vehiculo'];
            // Buscar directo
            const links = Array.from(document.querySelectorAll('a, span, div, li'));
            const target = links.find(el => {
                const t = (el.innerText || '').toLowerCase();
                return keywords.some(k => t.includes(k)) && el.innerText.length < 50;
            });

            if (target) {
                target.click();
                return 'direct';
            }

            // Buscar menú reportes
            const reportMenu = links.find(el => el.innerText.trim().toLowerCase() === 'reportes');
            if (reportMenu) {
                reportMenu.click();
                return 'menu';
            }
            return false;
        });

        if (found === 'menu') {
            // Esperar un momento a que se despliegue el submenú de forma eficiente
            await new Promise(r => setTimeout(r, 500));
            await page.evaluate(() => {
                const subLinks = Array.from(document.querySelectorAll('a, span, div, li'));
                const subTarget = subLinks.find(el => {
                    const t = (el.innerText || '').toLowerCase();
                    return ['producción', 'produccion'].some(k => t.includes(k)) && el.offsetParent !== null;
                });
                if (subTarget) subTarget.click();
            });
        }

        // Esperar botón "Generar" o similar
        try {
            // Un selector genérico para botones de acción con texto clave
            await page.waitForFunction(() => {
                const els = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                return els.some(e => ['generar', 'buscar', 'ver'].some(k => (e.innerText || e.value || '').toLowerCase().includes(k)));
            }, { timeout: 8000 });

            await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                const btn = els.find(e => ['generar', 'buscar', 'ver'].some(k => (e.innerText || e.value || '').toLowerCase().includes(k)));
                if (btn) btn.click();
            });
        } catch (e) {
            console.log("No se requirió botón generar o no se encontró a tiempo.");
        }

        // 5. Esperar Tabla (Smart Wait)
        console.log('Esperando datos...');
        try {
            // Esperar a que aparezca una tabla con datos relevantes en cualquier frame
            await page.waitForFunction(() => {
                // Función que verifica si hay una tabla con datos 'interesantes'
                const checkDoc = (doc) => {
                    const tables = Array.from(doc.querySelectorAll('table'));
                    return tables.some(t => {
                        const txt = t.innerText.toLowerCase();
                        return (txt.includes('total') || txt.includes('pax')) && (txt.includes('móvil') || txt.includes('interno') || txt.includes('placa'));
                    });
                };

                // Verificar frame principal
                if (checkDoc(document)) return true;

                // Verificar iframes
                for (const frame of window.frames) {
                    try { if (checkDoc(frame.document)) return true; } catch (e) { }
                }
                return false;
            }, { timeout: 15000, polling: 500 }); // Polling cada 500ms
        } catch (e) {
            // Fallback si waitForFunction falla
            console.log("Wait for table timeout, intentando scrape de todos modos.");
        }

        // 6. Extracción (Optimizada para velocidad)
        const vehicles = await page.evaluate(() => {
            const extractFromDoc = (doc) => {
                const tables = Array.from(doc.querySelectorAll('table'));
                const results = [];
                for (const table of tables) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length < 2) continue;

                    // Lógica simplificada y rápida: buscar celdas que parecen IDs y Pasajeros
                    for (const row of rows) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        if (cells.length < 4) continue;

                        // Heurística rápida por posición (común en estos reportes) + búsqueda
                        const txts = cells.map(c => c.innerText.trim());

                        // Buscar un ID de vehículo (números cortos)
                        const idIdx = txts.findIndex(t => /^\d{1,4}$/.test(t) || /^(N|M|Int|No)[\s-]?\d{1,4}$/i.test(t));
                        if (idIdx === -1) continue;

                        // Buscar un valor de pasajeros (número > 0 < 2000, más adelante en la fila)
                        for (let i = idIdx + 1; i < txts.length; i++) {
                            const val = parseInt(txts[i]);
                            if (!isNaN(val) && val >= 0 && val < 2000 && !txts[i].includes(':') && !txts[i].includes('-')) {
                                // Encontrado par candidato
                                const rawId = txts[idIdx].replace(/\D/g, '').replace(/^0+/, '');
                                if (!results.find(r => r.identifier === rawId)) {
                                    results.push({ identifier: rawId, pasajeros: val.toString() });
                                }
                                break; // Solo un dato de pasajeros por fila
                            }
                        }
                    }
                }
                return results;
            }

            let data = extractFromDoc(document);
            // Si no hay datos, barrer iframes
            if (data.length === 0) {
                const frames = Array.from(window.frames);
                for (let i = 0; i < frames.length; i++) {
                    try {
                        const frameData = extractFromDoc(frames[i].document);
                        if (frameData.length > 0) {
                            data = frameData;
                            break;
                        }
                    } catch (e) { }
                }
            }
            return data;
        });

        if (!vehicles || vehicles.length === 0) {
            // Fallback desesperado: Regex sobre todo el texto (muy rápido)
            const textDump = await page.evaluate(() => document.body.innerText);
            const regexMatches = [...textDump.matchAll(/\b(?:Int|Movil|No)?\.?\s*(\d{1,4})\s*[\s\S]{1,50}?\b(\d{1,4})\b/gi)];
            const backupVehicles = [];
            for (const m of regexMatches) {
                const id = m[1].replace(/^0+/, '');
                const val = parseInt(m[2]);
                if (val < 2000 && !backupVehicles.find(v => v.identifier === id)) {
                    backupVehicles.push({ identifier: id, pasajeros: val.toString() });
                }
            }
            if (backupVehicles.length > 0) {
                console.log("Extracción fallback regex exitosa.");
                res.json({ success: true, vehicles: backupVehicles });
            } else {
                throw new Error("No se extrajeron datos válidos.");
            }
        } else {
            console.log(`Extracción exitosa: ${vehicles.length} registros.`);
            res.json({ success: true, vehicles });
        }

    } catch (error) {
        console.error('Error (Optimizado):', error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (page) {
            try {
                await page.close(); // Cerrar solo la pestaña (Página), mantener Browser vivo
            } catch (e) { }
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor Robot OPTIMIZADO listo en ${PORT}`);
});
