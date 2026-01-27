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
let globalPage = null;
let sessionActive = false;
let lastInteraction = 0;

// URL Base
const TARGET_URL = 'https://gps3regisdataweb.com/opita/index.jsp';

// --- INICIALIZACIÓN DEL NAVEGADOR ---
const initBrowser = async () => {
    if (!globalBrowser) {
        console.log('Lanzando navegador global (Modo Bala de Plata V5)...');
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

        await globalPage.setRequestInterception(true);
        globalPage.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media', 'script'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log('Navegador listo.');
    }
    return globalPage;
};

// --- LOGIN ---
const ensureLoggedIn = async (page, username, password) => {
    try {
        let currentUrl = page.url();
        let content = await page.content();

        let isLoginPage = content.includes('input type="text"') && content.includes('input type="password"');
        const sessionExpired = content.includes('finalizado la sesión') || content.includes('finalizado la sesion') || content.includes('Session timeout');

        if (!isLoginPage && currentUrl.includes('opita') && sessionActive && !sessionExpired) {
            lastInteraction = Date.now();
            return;
        }

        console.log('Iniciando sesión...');
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });

        await new Promise(r => setTimeout(r, 2000));
        let newUrl = page.url();
        let newContent = await page.content();

        if (newUrl.includes('app') || newUrl.includes('menu') || newUrl.includes('seguimiento') || (newContent.includes('opita') && !newContent.includes('input type="password"'))) {
            console.log('Redirección automática o sesión viva detectada. Saltando login.');
            sessionActive = true;
            return;
        }

        try {
            await page.waitForSelector('input[type="text"]', { visible: true, timeout: 10000 });
            await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
            await page.type('input[type="text"]', username);
            await page.type('input[type="password"]', password);
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            sessionActive = true;
            console.log('Login exitoso.');
        } catch (e) {
            if (page.url().includes('opita') && !page.url().includes('index.jsp')) {
                console.log('Login visual falló pero parece que estamos dentro. Continuando...');
                sessionActive = true;
                return;
            }
            throw e;
        }
    } catch (e) {
        console.error("Login falló:", e.message);
        sessionActive = false;
        throw e;
    }
};

// --- ROUTA PRINCIPAL (BALA DE PLATA + AUTO-HEALING) ---
app.post('/api/scrape-passengers', async (req, res) => {
    const { username, password, _retry } = req.body;

    try {
        const page = await initBrowser();
        await ensureLoggedIn(page, username, password);

        // CORRECCIÓN REFERER: Navegar a la página del reporte
        const REPORT_URL_DIRECT = 'https://gps3regisdataweb.com/opita/app/seguimiento/infogps.jsp?v=3sobcmjas4';
        if (!page.url().includes('infogps.jsp')) {
            console.log('Navegando al contexto del reporte...');
            await page.goto(REPORT_URL_DIRECT, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Ejecutando extracción directa (API Fetch)...');

        const vehicles = await page.evaluate(async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            // Restauramos configuración ORIGINAL (Bala de Plata Estática)
            const payload = `fechaInicio=${todayStr}+00%3A00%3A00&fechaFinal=${todayStr}+23%3A59%3A59&verCaptura=0&verPuntoControl=0&verPasajero=0&verAlarma=0&verConsolidado=0&verOtros=0&verValidacion=0&verTablet=0&fechaPredeterminada=2&placas=0%2CTHQ009%2CTHQ010&grupos=&rutas=&empresas=35&uniSeleccion=0&page=0&maxPerPage=500&init=0&lpto=&lalm=&lcap=&lval=&ltab=&unirPuntos=false&order=fecha_gps+DESC&agrupar=true&eventosActividad=36+%2C+69+%2C+191+%2C+500&minutosActividad=15&numLocActual=20`;

            try {
                const response = await fetch('https://gps3regisdataweb.com/opita/infoGPS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: payload
                });

                const htmlText = await response.text();

                if (!htmlText.includes('<tr') && !htmlText.includes('<td')) {
                    throw new Error('RESPUESTA_SERVIDOR_INVALIDA: ' + htmlText.substring(0, 300));
                }

                const div = document.createElement('div');
                div.innerHTML = '<table>' + htmlText + '</table>';

                const results = [];
                const clean = (t) => (t || '').toLowerCase().trim();
                const cleanNum = (t) => (t || '').replace(/\D/g, '');

                const allRows = Array.from(div.querySelectorAll('tr'));
                let targetColInterno = -1;
                let targetColTotal = -1;
                let headerFound = false;

                for (const row of allRows) {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    const texts = cells.map(c => clean(c.innerText));

                    const idxInt = texts.findIndex(t => t.includes('número interno') || t.includes('numero interno') || t === 'interno');
                    const idxTot = texts.findIndex(t => t.includes('total día') || t.includes('total dia'));

                    if (idxInt !== -1 && idxTot !== -1) {
                        targetColInterno = idxInt;
                        targetColTotal = idxTot;
                        headerFound = true;
                    }

                    if (headerFound) {
                        if (cells[targetColInterno] && cells[targetColTotal]) {
                            const valInterno = cells[targetColInterno].innerText.trim();
                            const valTotal = cells[targetColTotal].innerText.trim();

                            const id = valInterno.replace(/^[a-zA-Z]+0*/, '').replace(/^0+/, '');
                            const pax = cleanNum(valTotal);

                            if (id && pax !== '' && !isNaN(pax) && valInterno.length < 10) {
                                if (!results.find(v => v.identifier === id)) {
                                    results.push({ identifier: id, pasajeros: pax });
                                }
                            }
                        }
                    }
                }
                return results;

            } catch (err) {
                return { error: err.message };
            }
        });

        if (vehicles.error) throw new Error(vehicles.error);

        if (vehicles.length > 0) {
            console.log(`Éxito API. ${vehicles.length} móviles.`);
            res.json({ success: true, vehicles });
        } else {
            throw new Error("La API no retornó datos válidos o la tabla estaba vacía.");
        }

    } catch (error) {
        console.error('Error Robot:', error.message);

        // AUTO-HEALING: Auto-Reintento
        // Si no hemos reintentado ya y el error parece de sesión (end_session o similar)
        if (!_retry && (error.message.includes('end_session') || error.message.includes('RESPUESTA_SERVIDOR_INVALIDA'))) {
            console.log('⚠️ Detectado fallo de sesión. Ejecutando AUTO-REINTENTO (Reset total)...');

            // 1. Matar sesión
            sessionActive = false;
            try { await globalPage.deleteCookie(...(await globalPage.cookies())); } catch (e) { } // Borrar cookies
            try { if (globalPage) await globalPage.close(); } catch (e) { }
            try { if (globalBrowser) await globalBrowser.close(); } catch (e) { }
            globalPage = null;
            globalBrowser = null;

            // 2. Reintentar recursivamente
            req.body._retry = true;
            console.log('🔄 Re-lanzando petición limpia...');
            return app._router.handle(req, res, () => { });
        }

        // Limpieza final y error al cliente
        sessionActive = false;
        try { if (globalPage) await globalPage.close(); } catch (e) { }
        try { if (globalBrowser) await globalBrowser.close(); } catch (e) { }
        globalPage = null;
        globalBrowser = null;

        res.status(500).json({ success: false, message: error.message + ' (Sesión reiniciada, intente de nuevo)' });
    }
});

// Keep-alive simple
setInterval(() => {
    if (globalPage && sessionActive) {
        globalPage.evaluate(() => { window.scrollBy(0, 10); }).catch(() => sessionActive = false);
    }
}, 300000);

app.listen(PORT, () => {
    console.log(`Robot API DIRECTA V5 "Auto-Healing" escuchando en ${PORT}`);
    initBrowser();
});
