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
let lastLoginAt = 0; // Última vez que se pasó por la pantalla de entrada
const RELOGIN_EVERY_MS = 5 * 60 * 1000; // Con el aviso de "sesión finalizada" a la vista, re-entrar como mucho cada 5 min

// Configuración URL
const TARGET_URL = 'https://gps3regisdataweb.com/opita/index.jsp';

// --- INICIALIZACIÓN DEL NAVEGADOR (Solo una vez) ---
let launchPromise = null; // Evita lanzar dos navegadores a la vez (Render gratis tiene poca memoria)

const resetBrowser = () => {
    globalBrowser = null;
    globalPage = null;
    sessionActive = false;
};

const initBrowser = async () => {
    // Si Chrome se cayó (falta de memoria, crash) o la pestaña se cerró, volver a lanzarlo
    if (globalBrowser && (!globalBrowser.connected || !globalPage || globalPage.isClosed())) {
        console.log('⚠️ Navegador caído o pestaña cerrada. Relanzando...');
        try { await globalBrowser.close(); } catch (e) { }
        resetBrowser();
    }
    if (globalBrowser) return globalPage;
    if (!launchPromise) launchPromise = launchBrowser().finally(() => { launchPromise = null; });
    return launchPromise;
};

const launchBrowser = async () => {
    {
        console.log('Lanzando navegador global...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
                '--single-process', '--disable-gpu', '--disable-extensions'
            ]
        });
        browser.on('disconnected', () => {
            console.log('⚠️ Navegador desconectado.');
            if (globalBrowser === browser) resetBrowser();
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        // Bloqueo de recursos para velocidad + MODO ESPÍA (Ingeniería Inversa)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();

            // Espiar peticiones de datos (AJAX/Fetch)
            if (['xhr', 'fetch', 'script'].includes(type)) {
                // Solo nos interesan las que parezcan datos de móviles o actualizaciones
                if (req.url().includes('json') || req.url().includes('data') || req.url().includes('get') || req.url().includes('posicion')) {
                    console.log('>> 🕵️ SPIA DETECTÓ DATA: ', req.url());
                    console.log('   -> Método:', req.method());
                }
            }

            if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort();
            else req.continue();
        });

        // Espiar respuestas también (para ver si es JSON)
        page.on('response', async (resp) => {
            try {
                const type = resp.request().resourceType();
                if (['xhr', 'fetch'].includes(type)) {
                    const url = resp.url();
                    // Si parece importante, chequear headers
                    if (url.includes('seguimiento') || url.includes('ajax')) {
                        console.log('<< 🕵️ SPIA RECIBIÓ RESPUESTA:', url, 'Status:', resp.status());
                    }
                }
            } catch (e) { }
        });

        globalBrowser = browser;
        globalPage = page;
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
        let content = '';
        try {
            content = await page.content();
        } catch (e) {
            console.log("⚠️ Detectado conflicto de Frame (Detached). Forzando reinicio de sesión...", e.message);
            sessionActive = false;
        }

        // Detección de sesión caída o expirada
        // Mejorada: Busca texto visible de login además de inputs
        // Solo cuenta lo que se VE: la página del reporte trae escondido el aviso de "finalizado la sesión"
        // y cajas de texto (filtros), y eso hacía creer que la sesión se había caído en cada lectura.
        const visible = await page.evaluate(() => {
            const shown = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
            const docs = [document];
            for (let i = 0; i < window.frames.length; i++) { try { if (window.frames[i].document?.body) docs.push(window.frames[i].document); } catch (e) { } }
            return {
                text: (document.body.innerText || '').toLowerCase(),
                passwordVisible: Array.from(document.querySelectorAll('input[type="password"]')).some(shown),
                // El reporte (tabla con "Total día") está a la vista: estamos dentro y leyendo
                hasReport: docs.some(d => /total d[ií]a/i.test(d.body.innerText || ''))
            };
        });
        const pageText = visible.text;
        let isLoginPage = visible.passwordVisible || pageText.includes('inicia sesión');

        const sessionExpired = pageText.includes('finalizado la sesión') ||
            pageText.includes('finalizado la sesion') ||
            pageText.includes('session timeout');

        if (sessionExpired) {
            const at = pageText.search(/finalizado la sesi|session timeout/);
            console.log('Aviso de sesión en pantalla: "' + pageText.substring(Math.max(0, at - 60), at + 80).replace(/\s+/g, ' ') + '"');
        }

        // Si todo parece estar bien y no estamos en login, retornamos rápido.
        // Si el reporte sigue a la vista, el aviso de sesión no basta para volver a entrar en cada lectura
        // (eso hacía que cada lectura tardara ~30 s); igual se re-entra cada 5 min por si de verdad caducó.
        const reportStillThere = visible.hasReport && currentUrl.includes('infogps.jsp') &&
            Date.now() - lastLoginAt < RELOGIN_EVERY_MS;
        if (!isLoginPage && currentUrl.includes('opita') && sessionActive && (!sessionExpired || reportStillThere)) {
            console.log('Sesión activa detectada (Estado OK). Reutilizando...');
            lastInteraction = Date.now();
            return;
        }

        console.log('Sesión no detectada o expirada (Detectado: ' + (sessionExpired ? 'Mensaje Expirado' : 'Login visible') + '). Iniciando login...');

        // Reset flag de sesión si detectamos login
        sessionActive = false;
        lastLoginAt = Date.now();

        // Ir al login
        try {
            await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });
        } catch (navError) {
            console.error("Error navegando al login:", navError.message);

            if (navError.message.includes('ERR_TOO_MANY_REDIRECTS')) {
                console.log("♻️ Detectado bucle de redirección. Limpiando cookies y reintentando...");
                const client = await page.createCDPSession();
                await client.send('Network.clearBrowserCookies');
                await client.send('Network.clearBrowserCache');
                await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });
            } else {
                throw navError;
            }
        }

        // VERIFICACIÓN CRÍTICA: ¿Nos redirigió solos?
        // A veces el servidor recuerda la cookie y nos manda directo adentro.
        // Esperar un toque para ver si cambia la URL o el contenido
        await new Promise(r => setTimeout(r, 1500));
        currentUrl = page.url();
        content = await page.content();
        const freshPageText = (await page.evaluate(() => document.body.innerText)).toLowerCase();

        // Detectar si estamos adentro (URL contiene app/seguimiento o NO hay inputs de login)
        isLoginPage = content.includes('input type="text"') || freshPageText.includes('inicia sesión');
        const isInsideApp = currentUrl.includes('app') || currentUrl.includes('seguimiento') || currentUrl.includes('menu');

        if (isInsideApp && !isLoginPage) {
            console.log('El servidor nos redirigió automáticamente adentro. No es necesario escribir password.');
            sessionActive = true;
            lastInteraction = Date.now();
            return;
        }

        // Si seguimos viendo el form de login, ahí sí esperamos los campos
        try {
            console.log("Esperando campos de login...");
            // Aumentar timeout y quitar 'visible: true' estricto por si el bloqueo de CSS afecta
            // Usar selectores múltiples por si acaso
            const inputOptions = { timeout: 30000 };

            const userSelector = 'input[type="text"], input[name*="user"], input[name*="usu"], input[name*="login"]';
            const passSelector = 'input[type="password"], input[name*="pass"], input[name*="clave"], input[name*="contra"]';

            // BEFORE waiting, check one more time if we are already inside to avoid 30s timeout
            const quickCheck = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('menú') || text.includes('cerrar sesión') || text.includes('vehículos') || window.location.href.includes('seguimiento');
            });

            if (quickCheck) {
                console.log("Detectado estado 'Logueado' antes de esperar inputs. Saltando login.");
                sessionActive = true;
                return;
            }

            await page.waitForSelector(userSelector, { ...inputOptions, timeout: 5000 }); // Reducido para detectar fallo rápido y reintentar o asumir login
            await page.waitForSelector(passSelector, { ...inputOptions, timeout: 5000 });

            console.log("Campos detectados, escribiendo credenciales...");
            await page.type(userSelector, username, { delay: 10 });
            await page.type(passSelector, password, { delay: 10 });

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

            // Nueva Validación de Emergencia:
            // Si el timeout falló, es posible que YA estemos logueados pero la detección inicial falló
            // O que la página cargó pero los IDs cambiaron.
            const forcedCheck = await page.evaluate(() => document.body.innerText.length > 500); // Si hay contenido sustancial

            if (forcedCheck || (page.url().includes('opita') && !page.url().includes('index.jsp'))) {
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

// --- CHEQUEO DE VIDA (para despertar el servidor y comprobar que responde) ---
app.get(['/', '/health'], (req, res) => {
    res.json({
        ok: true,
        browser: !!globalBrowser,
        sessionActive,
        uptimeMin: Math.round(process.uptime() / 60),
        hasCredentials: !!lastCredentials,
        lastReadSecondsAgo: cache ? Math.round((Date.now() - cache.at) / 1000) : null,
    });
});

// --- LECTURA DEL REPORTE (una a la vez, porque hay una sola pestaña) ---
const scrapeVehicles = async (username, password) => {
    const startTotalTime = Date.now();

    try {
        console.log(`[${new Date().toLocaleTimeString()}] Iniciando petición de datos...`);
        const page = await initBrowser();

        // 1. Asegurar sesión (Con detección de bloqueo "Finalizado sesión")
        await ensureLoggedIn(page, username, password);

        // 2. Lógica Híbrida: MODO RÁPIDO (Click AJAX) vs MODO SEGURO (Navegación Total)
        const REPORT_URL_DIRECT = 'https://gps3regisdataweb.com/opita/app/seguimiento/infogps.jsp?v=3sobcmjas4';
        const currentUrl = page.url();
        let dataRefreshed = false;

        // A) MODO TURBO (V4.1): Intentar refresco (CLICK en buscar) solo si ya estamos en la URL correcta
        if (currentUrl.includes('infogps.jsp')) {
            console.log('⚡ MODO TURBO: Ya estamos en el reporte. Intentando actualización rápida...');
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
                    console.log('⚡ Botón clickeado. Esperando datos frescos...');
                    await new Promise(r => setTimeout(r, 1500)); // Espera reducida para AJAX
                    dataRefreshed = true;
                } else {
                    console.log('⚠️ No se encontró botón para Turbo. Pasando a recarga...');
                }
            } catch (e) {
                console.log('⚠️ Falló Turbo (' + e.message + '). Pasando a recarga...');
            }
        }

        // B) MODO SEGURO: Si el modo Turbo no se usó o falló, hacemos la recarga completa
        if (!dataRefreshed) {
            console.log('🐢 Ejecutando Recarga Completa (Primera vez o Fallback)...');
            await page.goto(REPORT_URL_DIRECT, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 1500));

            // Re-asegurar click tras carga completa
            await page.evaluate(() => {
                const iconBtn = document.querySelector('.fa-search, .glyphicon-search, span[class*="search"], i[class*="search"]')?.closest('a, button, div');
                if (iconBtn) iconBtn.click();
            });
            await new Promise(r => setTimeout(r, 1500));
        } else {
            console.log('⚡ Actualización Turbo completada.');
        }

        // 4. Extracción "VISUAL" + SOPORTE IFRAMES + WAIT (Optimizado 100ms polling)
        console.log('Extrayendo datos de Móviles...');

        // Espera activa: buscar texto "Total día" en cualquier frame con polling agresivo
        try {
            await page.waitForFunction(() => {
                const searchTxt = (doc) => (doc.body.innerText || '').toLowerCase().includes('total día') || (doc.body.innerText || '').toLowerCase().includes('total dia');
                if (searchTxt(document)) return true;
                for (let i = 0; i < window.frames.length; i++) { // window.frames no se puede recorrer con for...of
                    try { if (searchTxt(window.frames[i].document)) return true; } catch (e) { }
                }
                return false;
            }, { timeout: 10000, polling: 100 }); // Polling rápido 100ms
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
                const frames = Array.from({ length: window.frames.length }, (_, i) => window.frames[i]);
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
                let targetColLoc = -1;
                let targetColFecha = -1;
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
                        // Columnas opcionales: ubicación y hora del último reporte GPS
                        targetColLoc = texts.findIndex(t => t.includes('localizaci') || t.includes('ubicaci') || t.includes('direcci'));
                        targetColFecha = texts.findIndex(t => t.includes('fecha gps'));
                        if (targetColFecha === -1) targetColFecha = texts.findIndex(t => t.includes('fecha') || t.includes('hora'));
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
                                    const locCell = targetColLoc !== -1 ? cells[targetColLoc] : null;
                                    const fechaCell = targetColFecha !== -1 ? cells[targetColFecha] : null;
                                    const link = locCell?.querySelector('a')?.href || '';
                                    // Coordenadas exactas si la página las trae en el enlace o en el onclick (ej. "2.9273,-75.2819")
                                    const anchor = locCell?.querySelector('a');
                                    const rawLink = [anchor?.getAttribute('href'), anchor?.getAttribute('onclick'), locCell?.getAttribute('onclick'), locCell?.innerHTML].filter(Boolean).join(' ');
                                    const coords = rawLink.match(/(-?\d{1,2}\.\d{4,})\s*[,;'"\s]+\s*(-?\d{1,3}\.\d{4,})/);
                                    results.push({
                                        identifier: id,
                                        pasajeros: pax,
                                        localizacion: locCell ? locCell.innerText.replace(/\s+/g, ' ').trim() : '',
                                        fechaGps: fechaCell ? fechaCell.innerText.replace(/\s+/g, ' ').trim() : '',
                                        mapaUrl: /^https?:/i.test(link) ? link : '',
                                        lat: coords ? Number(coords[1]) : null,
                                        lng: coords ? Number(coords[2]) : null,
                                    });
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
            const totalTime = Date.now() - startTotalTime;
            console.log(`✅ Éxito. ${vehicles.length} móviles encontrados. Tiempo Total: ${totalTime / 1000}s`);
            return vehicles;
        } else {
            const debugInfo = await page.evaluate(() => document.body.innerText.substring(0, 300).replace(/\n/g, ' '));
            throw new Error(`Header 'Total día' no hallado. (Probable sesión caducada o tabla oculta). Texto visible: ${debugInfo}...`);
        }

    } catch (error) {
        console.error('Error Robot:', error);
        // Si el error viene de un navegador roto, forzar relanzamiento en el próximo intento
        if (/Target closed|Session closed|detached|Protocol error|Connection closed/i.test(error.message || '')) {
            try { await globalBrowser?.close(); } catch (e) { }
            resetBrowser();
        }
        throw error;
    }
};

// --- CACHÉ Y SESIÓN SIEMPRE ABIERTA ---
// El robot relee el GPS por su cuenta para que la sesión de la página nunca se cierre por inactividad
// y la app reciba el dato al instante: cada 20 s si alguien consultó en los últimos 30 min,
// y cada 30 s el resto del tiempo (solo de 5 a.m. a 11 p.m. hora Colombia). Credenciales solo en memoria,
// o en las variables de entorno GPS_USERNAME / GPS_PASSWORD si se configuran en Render (así arranca ya logueado).
const CACHE_MAX_AGE_MS = 30 * 1000;          // Dato más viejo que esto => se lee de nuevo antes de responder
const STALE_MAX_AGE_MS = 10 * 60 * 1000;    // Dato guardado que todavía se muestra al instante mientras llega el nuevo
const ACTIVE_REFRESH_MS = 20 * 1000;         // Relectura mientras la app está en uso
const IDLE_REFRESH_MS = 30 * 1000;           // Relectura para mantener viva la sesión cuando nadie consulta
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;     // "En uso" = alguien consultó en los últimos 30 min
const WORK_HOURS = { from: 5, to: 23 };      // Horario (Colombia) en que se mantiene la sesión abierta

let cache = null;            // { vehicles, at, username }
let inFlight = null;         // Promesa de la lectura en curso (para no leer dos veces a la vez)
let lastCredentials = null;
let lastClientRequest = 0;

const refreshCache = (username, password) => {
    if (!inFlight) {
        inFlight = scrapeVehicles(username, password)
            .then(vehicles => { cache = { vehicles, at: Date.now(), username }; return cache; })
            .finally(() => { inFlight = null; });
    }
    return inFlight;
};

// --- RUTA PRINCIPAL ---
app.post('/api/scrape-passengers', async (req, res) => {
    const { username, password, fresh: wantFresh } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, message: 'Faltan credenciales' });
    lastCredentials = { username, password };
    lastClientRequest = Date.now();

    try {
        let result = cache && cache.username === username ? cache : null;
        const age = result ? Date.now() - result.at : Infinity;
        const fresh = age < CACHE_MAX_AGE_MS;
        // Respuesta inmediata: si hay un dato guardado reciente (menos de STALE_MAX_AGE_MS), se entrega ya
        // y se busca uno nuevo en segundo plano; la app vuelve a preguntar con fresh=true para recibirlo.
        if (!fresh && !wantFresh && age < STALE_MAX_AGE_MS) {
            refreshCache(username, password).catch(e => console.log('Relectura tras respuesta rápida falló:', e.message));
            return res.json({ success: true, vehicles: result.vehicles, updatedAt: result.at, cached: true, refreshing: true });
        }
        if (!fresh) result = await refreshCache(username, password);
        res.json({ success: true, vehicles: result.vehicles, updatedAt: result.at, cached: fresh, refreshing: false });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- FORMULARIO PREOPERACIONAL (Google Forms) ---
// La app manda las respuestas (sacadas del link ya rellenado) y el correo; aquí se envían a Google.
// Solo se acepta este formulario, para que el servidor no sirva para enviar otros.
const PREOP_FORM_ID = '1FAIpQLScOLIelV9FBvOWZL8aseQWFYxc1dL7fYNfnpRbRK3N3hSBKQA';
const PREOP_SUBMIT_URL = `https://docs.google.com/forms/d/e/${PREOP_FORM_ID}/formResponse`;

app.post('/api/preoperacional', async (req, res) => {
    const { email, entries } = req.body || {};
    if (!email || !entries || typeof entries !== 'object') {
        return res.status(400).json({ success: false, message: 'Faltan el correo o las respuestas' });
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(entries)) {
        if (/^entry\.\d+$/.test(key)) body.append(key, String(value));
    }
    body.append('emailAddress', String(email));
    body.append('fvv', '1');
    body.append('pageHistory', '0,1'); // El formulario tiene 2 páginas

    try {
        const response = await fetch(PREOP_SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const html = await response.text();
        // Google devuelve la página de "Se registró tu respuesta"; si falta algo, devuelve error o el formulario otra vez.
        const ok = response.ok && !/name="entry\.\d+"/.test(html);
        console.log(`[${new Date().toLocaleTimeString()}] Preoperacional: código ${response.status}, ${ok ? 'enviado' : 'rechazado'}`);
        if (!ok) {
            return res.status(502).json({ success: false, message: `Google no aceptó el formulario (código ${response.status}). Puede que hayan cambiado las preguntas.` });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Preoperacional:', error.message);
        res.status(500).json({ success: false, message: 'No se pudo llegar a Google Forms: ' + error.message });
    }
});

const colombiaHour = () => Number(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false })) % 24;

let lastBackgroundRefresh = 0;
setInterval(() => {
    if (!lastCredentials || inFlight) return;
    const active = Date.now() - lastClientRequest < ACTIVE_WINDOW_MS;
    const hour = colombiaHour();
    const inWorkHours = hour >= WORK_HOURS.from && hour < WORK_HOURS.to;
    if (!active && !inWorkHours) return;
    const every = active ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS;
    if (Date.now() - lastBackgroundRefresh < every) return;
    lastBackgroundRefresh = Date.now();
    refreshCache(lastCredentials.username, lastCredentials.password)
        .catch(e => console.log('Relectura en segundo plano falló:', e.message));
}, 10 * 1000);

// Auto-visita: Render gratis apaga el servidor tras 15 min sin visitas desde afuera (lo que el robot hace
// por dentro no cuenta). En horario de trabajo el servidor se visita a sí mismo por su dirección pública
// cada 10 min para no dormirse y no perder la sesión del GPS.
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;
if (PUBLIC_URL) {
    setInterval(() => {
        const hour = colombiaHour();
        if (hour < WORK_HOURS.from || hour >= WORK_HOURS.to) return;
        fetch(`${PUBLIC_URL}/health`).catch(e => console.log('Auto-visita falló:', e.message));
    }, 10 * 60 * 1000);
}

if (process.env.GPS_USERNAME && process.env.GPS_PASSWORD) {
    lastCredentials = { username: process.env.GPS_USERNAME, password: process.env.GPS_PASSWORD };
}

app.listen(PORT, () => {
    console.log(`Robot Persistente V3.2 (Hybrid) escuchando en ${PORT}`);
    initBrowser()
        .then(() => {
            // Si hay credenciales configuradas, entrar de una vez para que la primera consulta ya sea rápida
            if (lastCredentials) return refreshCache(lastCredentials.username, lastCredentials.password);
        })
        .catch(e => console.error('Arranque del robot:', e.message));
});
