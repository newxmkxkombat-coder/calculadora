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

        // Detección de sesión caída o expirada
        // "Ha finalizado la sesión" es el texto clave que reportó el error
        const isLoginPage = content.includes('input type="text"') && content.includes('input type="password"');
        const sessionExpired = content.includes('finalizado la sesión') || content.includes('finalizado la sesion') || content.includes('Session timeout');

        if (isLoginPage || !currentUrl.includes('opita') || !sessionActive || sessionExpired) {
            console.log('Sesión no detectada o expirada (Detectado: ' + (sessionExpired ? 'Mensaje Expirado' : 'Login Form/Otro') + '). Logueándose...');

            // Si la sesión expiró, a veces hay que navegar explícitamente a la raíz para limpiar el estado y ver el login
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

        // 1. Asegurar sesión (Con detección de bloqueo "Finalizado sesión")
        await ensureLoggedIn(page, username, password);

        // 2. Navegar a "Móviles" específicamente
        console.log('Navegando a reporte de Móviles...');

        // Navegar/Clickea en Móviles
        await page.evaluate(async () => {
            const links = Array.from(document.querySelectorAll('a, span, div, li'));
            // Buscar "Móviles" exacto o contenido
            const target = links.find(el => {
                const t = (el.innerText || '').toLowerCase().trim();
                return t === 'móviles' || t === 'moviles';
            });

            if (target) {
                target.click();
            } else {
                // Si no, intentar abrir menú Reportes primero
                const reportes = links.find(el => (el.innerText || '').toLowerCase().trim() === 'reportes');
                if (reportes) reportes.click();
            }
        });

        await new Promise(r => setTimeout(r, 1500));

        // Asegurar Submenú si es necesario
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, span, div, li'));
            const target = links.find(el => {
                const t = (el.innerText || '').toLowerCase();
                return (t === 'móviles' || t === 'moviles') && el.offsetParent !== null;
            });
            if (target) target.click();
        });

        // 3. ACTUALIZAR (Click Lupa/Buscar) - CRÍTICO
        console.log('Actualizando datos...');
        await new Promise(r => setTimeout(r, 1000));

        const searchClicked = await page.evaluate(() => {
            // Estrategia 1: Botón con texto
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
            const textBtn = btns.find(b =>
                ['generar', 'buscar', 'consultar', 'ver'].some(k => (b.innerText || b.value || '').toLowerCase().includes(k))
            );
            if (textBtn) { textBtn.click(); return true; }

            // Estrategia 2: La Lupa (icono) o botón verde (desagrupar)
            // Buscamos cualquier elemento que parezca un botón de búsqueda (icono fa-search, img lupa, etc)
            const iconBtn = document.querySelector('.fa-search, .glyphicon-search, span[class*="search"], i[class*="search"]')?.closest('a, button, div');
            if (iconBtn) { iconBtn.click(); return true; }

            return false;
        });

        // Espera un poco más generosa para la carga de datos
        await new Promise(r => setTimeout(r, 3000));


        // 4. Extracción "VISUAL" + SOPORTE IFRAMES + WAIT
        console.log('Extrayendo datos de Móviles (Modo Visual + Frames)...');

        // Espera activa: buscar texto "Total día" en cualquier frame antes de intentar leer
        try {
            await page.waitForFunction(() => {
                const searchTxt = (doc) => (doc.body.innerText || '').toLowerCase().includes('total día') || (doc.body.innerText || '').toLowerCase().includes('total dia');

                if (searchTxt(document)) return true;
                for (const frame of window.frames) {
                    try { if (searchTxt(frame.document)) return true; } catch (e) { }
                }
                return false;
            }, { timeout: 15000, polling: 1000 });
        } catch (e) {
            console.log("Timeout esperando texto 'Total día', intentando extraer de todos modos...");
            // Si falla la espera, puede ser que el texto esté pero waitForFunction fallara por contexto
        }

        const vehicles = await page.evaluate(() => {
            const results = [];
            const clean = (t) => (t || '').toLowerCase().trim();
            const cleanNum = (t) => (t || '').replace(/\D/g, '');

            // Recopilar todos los documentos (Main + Iframes)
            const docs = [document];
            try {
                const frames = Array.from(window.frames);
                for (const f of frames) {
                    try { docs.push(f.document); } catch (e) { }
                }
            } catch (e) { }

            // Barrer cada documento buscando las filas mágicas
            for (const doc of docs) {
                const allRows = Array.from(doc.querySelectorAll('tr'));
                if (allRows.length === 0) continue;

                let targetColInterno = -1;
                let targetColTotal = -1;
                let headerFound = false;

                // 2 Barridos: Primero encontrar headers, luego extraer
                // Barrido 1: Encontrar Headers relativos a esta tabla/frame
                for (const row of allRows) {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    if (cells.length < 2) continue;

                    const texts = cells.map(c => clean(c.innerText));

                    // Buscar coordenadas
                    const idxInt = texts.findIndex(t => t.includes('número interno') || t.includes('numero interno') || t === 'interno');
                    const idxTot = texts.findIndex(t => t.includes('total día') || t.includes('total dia'));

                    if (idxInt !== -1 && idxTot !== -1) {
                        targetColInterno = idxInt;
                        targetColTotal = idxTot;
                        headerFound = true;
                        break; // Dejar de buscar headers en este doc, ya los tenemos
                    }
                }

                // Barrido 2: Extraer si encontramos headers en este doc
                if (headerFound) {
                    for (const row of allRows) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        // Verificamos si esta fila tiene celdas en las posiciones clave
                        if (cells[targetColInterno] && cells[targetColTotal]) {
                            const valInterno = cells[targetColInterno].innerText.trim();
                            const valTotal = cells[targetColTotal].innerText.trim();

                            // Limpieza y Validación
                            // "N015" -> "15"
                            const id = valInterno.replace(/^[a-zA-Z]+0*/, '').replace(/^0+/, '');
                            const pax = cleanNum(valTotal);

                            // Validar que parece un dato real (ID corto, Pax numérico)
                            // valInterno < 10 chars para evitar leer el header mismo o pies de pagina
                            if (id && pax !== '' && !isNaN(pax) && valInterno.length < 10) {
                                if (!results.find(v => v.identifier === id)) {
                                    results.push({ identifier: id, pasajeros: pax });
                                }
                            }
                        }
                    }
                    if (results.length > 0) return results; // Si sacamos datos de este frame, terminamos
                }
            }
            return results;
        });

        if (vehicles.length > 0) {
            console.log(`Éxito. ${vehicles.length} móviles encontrados.`);
            res.json({ success: true, vehicles });
        } else {
            const debugInfo = await page.evaluate(() => document.body.innerText.substring(0, 300).replace(/\n/g, ' '));
            throw new Error(`Header 'Total día' no hallado. (Probable sesión caducada o tabla oculta). Texto visible: ${debugInfo}...`);
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
    console.log(`Robot Persistente V3.1 escuchando en ${PORT}`);
    initBrowser(); // Arrancar browser al inicio
});
