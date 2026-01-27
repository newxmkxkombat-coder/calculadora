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

        // Bloqueo de recursos para velocidad + MODO ESPÍA (Ingeniería Inversa)
        await globalPage.setRequestInterception(true);
        globalPage.on('request', (req) => {
            const type = req.resourceType();

            // Espiar peticiones de datos (AJAX/Fetch)
            if (['xhr', 'fetch', 'script'].includes(type)) {
                // Solo nos interesan las que parezcan datos de móviles o actualizaciones
                if (req.url().includes('json') || req.url().includes('data') || req.url().includes('get') || req.url().includes('posicion') || req.url().includes('infoGPS')) {
                    console.log('>> 🕵️ SPIA DETECTÓ DATA: ', req.url());
                    console.log('   -> Método:', req.method());
                    if (req.method() === 'POST' && req.url().includes('infoGPS')) {
                        console.log('   📤 POST DATA para infoGPS:', req.postData());
                    }
                }
            }

            if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort();
            else req.continue();
        });

        // Espiar respuestas también (para ver contenido real)
        globalPage.on('response', async (resp) => {
            try {
                const url = resp.url();
                // Solo nos interesan nuestros sospechosos
                if (url.includes('infoGPS') || url.includes('loadGPSStatus') || url.includes('ejecutarNotificaciones')) {
                    console.log(`<< 🕵️ REVISANDO CONTENIDO DE: ${url}`);
                    try {
                        const text = await resp.text();
                        // Imprimir los primeros 500 caracteres para ver si es JSON con datos
                        console.log('   📦 DATO:', text.substring(0, 500));
                    } catch (err) {
                        console.log('   ❌ No se pudo leer texto:', err.message);
                    }
                }
            } catch (e) { }
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
        let currentUrl = page.url();
        let content = await page.content();

        // Detección de sesión caída o expirada
        // "Ha finalizado la sesión" es el texto clave que reportó el error
        let isLoginPage = content.includes('input type="text"') && content.includes('input type="password"');
        const sessionExpired = content.includes('finalizado la sesión') || content.includes('finalizado la sesion') || content.includes('Session timeout');

        // Si todo parece estar bien y no estamos en login, retornamos rápido
        if (!isLoginPage && currentUrl.includes('opita') && sessionActive && !sessionExpired) {
            console.log('Sesión activa detectada (Estado OK). Reutilizando...');
            lastInteraction = Date.now();
            return;
        }

        console.log('Sesión no detectada o expirada (Detectado: ' + (sessionExpired ? 'Mensaje Expirado' : 'Login/Otro') + '). Iniciando login...');

        // Ir al login
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });

        // VERIFICACIÓN CRÍTICA: ¿Nos redirigió solos?
        // A veces el servidor recuerda la cookie y nos manda directo adentro.
        // Esperar un toque para ver si cambia la URL o el contenido
        await new Promise(r => setTimeout(r, 1500));
        currentUrl = page.url();
        content = await page.content();

        // Detectar si estamos adentro (URL contiene app/seguimiento o NO hay inputs de login)
        isLoginPage = content.includes('input type="text"') && content.includes('input type="password"');
        const isInsideApp = currentUrl.includes('app') || currentUrl.includes('seguimiento') || currentUrl.includes('menu');

        if (isInsideApp && !isLoginPage) {
            console.log('El servidor nos redirigió automáticamente adentro. No es necesario escribir password.');
            sessionActive = true;
            lastInteraction = Date.now();
            return;
        }

        // Si seguimos viendo el form de login, ahí sí esperamos los campos
        try {
            await page.waitForSelector('input[type="text"]', { visible: true, timeout: 10000 });
            await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });

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
            console.log('Login manual exitoso.');
        } catch (e) {
            console.log("Advertencia en Login Manual: " + e.message);
            // Fallback final: Si por alguna razón dio timeout pero SÍ estamos dentro
            if (page.url().includes('opita') && !page.url().includes('index.jsp')) {
                console.log("Recuperación: El sistema está dentro a pesar del error.");
                sessionActive = true;
                return;
            }
            throw e;
        }

        sessionActive = true;
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

        // 2. Lógica Híbrida: MODO RÁPIDO (Click AJAX) vs MODO SEGURO (Navegación Total)
        const REPORT_URL_DIRECT = 'https://gps3regisdataweb.com/opita/app/seguimiento/infogps.jsp?v=3sobcmjas4';
        const currentUrl = page.url();
        let dataRefreshed = false;

        // A) MODO RÁPIDO: Intentar refresco (CLICK en buscar) solo si ya estamos en la URL correcta
        if (currentUrl === REPORT_URL_DIRECT) {
            console.log('Ya estamos en el reporte. Intentando actualización RÁPIDA (Click)...');
            try {
                // Clickear botón Buscar/Lupa sin recargar página
                const refreshed = await page.evaluate(() => {
                    // Estrategia combinada de botones
                    const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
                    const textBtn = btns.find(b =>
                        ['generar', 'buscar', 'consultar', 'ver'].some(k => (b.innerText || b.value || '').toLowerCase().includes(k))
                    );
                    if (textBtn) { textBtn.click(); return true; }

                    const iconBtn = document.querySelector('.fa-search, .glyphicon-search, span[class*="search"], i[class*="search"]')?.closest('a, button, div');
                    if (iconBtn) { iconBtn.click(); return true; }
                    return false;
                });

                if (refreshed) {
                    // Esperamos la carga de datos AJAX (2.5s es más rápido que una recarga total de 10s)
                    console.log('Botón clickeado. Esperando datos frescos...');
                    await new Promise(r => setTimeout(r, 2500));
                    dataRefreshed = true;
                } else {
                    console.log('No se encontró botón para modo rápido. Pasando a modo seguro...');
                }
            } catch (e) {
                console.log('Falló modo rápido (' + e.message + '). Pasando a modo seguro...');
            }
        }

        // B) MODO SEGURO: Si el modo rápido no se usó o falló, hacemos la recarga completa (Navegar de cero)
        if (!dataRefreshed) {
            console.log('Ejecutando Carga COMPLETA (Modo Seguro - Recarga total)...');
            await page.goto(REPORT_URL_DIRECT, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));

            // Re-asegurar click tras carga completa por si la tabla viene vacía
            await page.evaluate(() => {
                const iconBtn = document.querySelector('.fa-search, .glyphicon-search, span[class*="search"], i[class*="search"]')?.closest('a, button, div');
                if (iconBtn) iconBtn.click();
            });
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log('Actualización rápida completada sin recargas.');
        }

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
    console.log(`Robot Persistente V3.2 (Hybrid) escuchando en ${PORT}`);
    initBrowser(); // Arrancar browser al inicio
});
