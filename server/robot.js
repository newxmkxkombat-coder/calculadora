import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
// Configurar CORS para permitir peticiones desde tu GitHub Pages
app.use(cors({
    origin: '*', // Por ahora permitimos todo para facilitar pruebas.
    // Cuando esté listo, cámbialo por: 'https://tu-usuario.github.io'
    methods: ['GET', 'POST']
}));
app.options(/(.*)/, cors()); // Habilitar pre-flight para todas las rutas
app.options('/api/scrape-passengers', cors()); // Explicit OPTIONS for this route
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.post('/api/scrape-passengers', async (req, res) => {
    const { username, password } = req.body;
    const TARGET_URL = 'https://gps3regisdataweb.com/opita/index.jsp';

    console.log(`Iniciando robot para usuario: ${username}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            // 'new' es el nuevo modo headless, más rápido y compatible
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        // Configurar vista de escritorio para evitar menús móviles colapsados
        await page.setViewport({ width: 1366, height: 768 });

        // 1. Ir al Login
        console.log('Navegando a login...');
        await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });

        // 2. Llenar credenciales
        const userInput = await page.$('input[type="text"]');
        const passInput = await page.$('input[type="password"]');

        if (!userInput || !passInput) {
            throw new Error("No se encontraron los campos de usuario/contraseña.");
        }

        await userInput.type(username);
        await passInput.type(password);

        // 3. Click Ingresar
        const loginSuccess = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
            const loginBtn = buttons.find(b => b.innerText.toLowerCase().includes('ingresar') || b.value?.toLowerCase().includes('ingresar'));
            if (loginBtn) {
                loginBtn.click();
                return true;
            }
            return false;
        });

        if (!loginSuccess) {
            await page.keyboard.press('Enter');
        }

        // Esperar navegación post-login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log("Timeout navegacion post-login ignorado."));
        await new Promise(r => setTimeout(r, 4000)); // Esperar carga extra del dashboard

        // 4. Navegación Inteligente
        console.log('Buscando ruta a datos...');

        // ESTRATEGIA PRINCIPAL: Buscar acceso directo a "Rep. Hoy" (Reporte Hoy)
        const reportHoyClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, span, div, li'));
            const btn = elements.find(el => {
                const text = (el.innerText || '').toLowerCase();
                return text.includes('rep. hoy') || (text.includes('reporte') && text.includes('hoy'));
            });
            if (btn && btn.offsetParent !== null) {
                btn.click();
                return true;
            }
            return false;
        });

        if (reportHoyClicked) {
            console.log('Click exitoso en "Rep. Hoy". Esperando carga de reporte (5s)...');
            await new Promise(r => setTimeout(r, 5000));
        } else {
            console.log('"Rep. Hoy" no visible, intentando ruta clásica Rastreo -> Móviles...');

            // Rastreo -> Móviles
            await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('a, div[role="button"], span, div'));
                const rastreo = elements.find(el => el.innerText && el.innerText.trim() === 'Rastreo');
                if (rastreo) rastreo.click();
            });
            await new Promise(r => setTimeout(r, 2000));

            const movilesClicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('a, div[role="button"], span, div, li'));
                const moviles = elements.find(el => (el.innerText || '').toLowerCase().includes('moviles') || (el.innerText || '').toLowerCase().includes('móviles'));
                if (moviles) {
                    moviles.click();
                    return true;
                }
                return false;
            });

            if (!movilesClicked) {
                const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
                throw new Error(`No se encontró menú 'Rastreo' ni 'Rep. Hoy'. Info: ${bodyText}`);
            }
            await new Promise(r => setTimeout(r, 4000));
        }

        // HEURÍSTICA: Buscar botón "Generar" o "Buscar" por si hay filtro previo
        try {
            await page.evaluate(() => {
                const keywords = ['buscar', 'generar', 'consultar', 'ver reporte', 'refresh', 'actualizar'];
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, div.btn'));
                const actionBtn = buttons.find(b => {
                    const text = (b.innerText || b.value || '').toLowerCase();
                    return keywords.some(k => text.includes(k));
                });
                if (actionBtn && actionBtn.offsetParent !== null) actionBtn.click();
            });
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) { }


        // 5. Esperar Tabla y Extraer (Soporte Universal)
        console.log('Esperando resultados finales...');

        let targetFrame = null;
        let foundTable = false;
        const startTime = Date.now();

        // Bucle de búsqueda (60 segundos)
        while (Date.now() - startTime < 60000) {
            const pages = await browser.pages();
            for (const p of pages) {
                const frames = [p.mainFrame(), ...p.frames()];
                for (const frame of frames) {
                    try {
                        const tableFound = await frame.evaluate(() => {
                            const tables = Array.from(document.querySelectorAll('table'));
                            return tables.some(t => {
                                const text = t.innerText.toLowerCase();
                                return (text.includes('total dia') || text.includes('total día')) && text.includes('interno');
                            });
                        });
                        if (tableFound) {
                            targetFrame = frame;
                            foundTable = true;
                            break;
                        }
                    } catch (e) { }
                }
                if (foundTable) break;
            }
            if (foundTable) break;
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!targetFrame) {
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 300));
            throw new Error(`Reporte no cargado. Vista actual: "${pageSnapshot}..."`);
        }

        console.log(`Fuente de datos encontrada. Extrayendo...`);

        const vehicles = await targetFrame.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            let bestResults = [];
            let maxDataCount = -1;

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length < 2) continue;

                let colIdx = { interno: -1, total: -1 };
                let foundHeaders = false;

                // 1. Buscar Headers
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const texts = Array.from(rows[i].querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());
                    const idxTotal = texts.findIndex(t => t.includes('total d') || t.includes('total d\u00EDa'));
                    const idxInterno = texts.findIndex(t => t.includes('interno') || t.includes('unidad') || t.includes('m\u00F3vil'));

                    if (idxTotal !== -1 && idxInterno !== -1) {
                        colIdx.total = idxTotal;
                        colIdx.interno = idxInterno;
                        foundHeaders = true;
                        break;
                    }
                }

                if (foundHeaders) {
                    const currentData = [];
                    for (let j = 0; j < rows.length; j++) {
                        const cells = Array.from(rows[j].querySelectorAll('td'));
                        if (cells.length <= Math.max(colIdx.interno, colIdx.total)) continue;

                        const idRaw = cells[colIdx.interno].innerText.trim();
                        const paxRaw = cells[colIdx.total].innerText.trim();

                        const id = idRaw.replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');
                        const pax = parseInt(paxRaw.replace(/\D/g, ''));

                        // Validar: No es año (2025/2026), es número real
                        if (id && !isNaN(pax) && (pax < 2024 || pax > 2030)) {
                            if (!currentData.find(v => v.identifier === id)) {
                                currentData.push({ identifier: id, pasajeros: pax.toString() });
                            }
                        }
                    }

                    // Priorizar tabla con más datos o con datos no-cero
                    const nonZeroCount = currentData.filter(d => d.pasajeros !== "0").length;
                    if (nonZeroCount > maxDataCount) {
                        maxDataCount = nonZeroCount;
                        bestResults = currentData;
                    } else if (maxDataCount === 0 && currentData.length > bestResults.length) {
                        bestResults = currentData;
                    }
                }
            }

            // Fallback Heurístico (Col 3 Interno, Col 8 Total Dia)
            if (bestResults.length === 0) {
                for (const table of tables) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    const currentData = [];
                    for (const row of rows) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        if (cells.length >= 9) {
                            const id = cells[3].innerText.trim().replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');
                            const pax = parseInt(cells[8].innerText.replace(/\D/g, ''));
                            if (id && !isNaN(pax) && (pax < 2024 || pax > 2030)) {
                                if (!currentData.find(v => v.identifier === id)) {
                                    currentData.push({ identifier: id, pasajeros: pax.toString() });
                                }
                            }
                        }
                    }
                    if (currentData.length > bestResults.length) bestResults = currentData;
                }
            }

            return bestResults;
        });

        if (!vehicles || vehicles.length === 0) {
            throw new Error(`Reporte vacío. Posiblemente no ha cargado los datos todavía.`);
        }

        console.log(`Encontrados ${vehicles.length} vehículos con datos.`);
        setTimeout(() => browser.close(), 3000);
        res.json({ success: true, vehicles });

    } catch (error) {
        console.error('Error crítico:', error);
        if (browser) await browser.close();
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Robot GPS listo en puerto ${PORT}`);
});
