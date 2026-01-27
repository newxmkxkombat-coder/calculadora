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

        // 4. Navegación Inteligente (Reforzada)
        console.log('Buscando ruta a datos...');

        // Intentar expandir menús principales primero
        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('a, span, div, li, b'));
            const mainMenus = items.filter(el => {
                const text = (el.innerText || '').toLowerCase().trim();
                return text === 'reportes' || text === 'rastreo' || text === 'consultas';
            });
            mainMenus.forEach(m => m.click());
        });
        await new Promise(r => setTimeout(r, 2000));

        // Buscar el reporte específico
        const navSuccess = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, span, div, li'));
            const keywords = ['rep. hoy', 'reporte hoy', 'móviles', 'moviles', 'reporte diario', 'actividad'];

            const btn = elements.find(el => {
                const text = (el.innerText || '').toLowerCase();
                return keywords.some(k => text.includes(k)) && el.offsetParent !== null;
            });

            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (navSuccess) {
            console.log('Navegación a reporte exitosa. Esperando carga (6s)...');
            await new Promise(r => setTimeout(r, 6000));
        } else {
            console.log('No se halló el botón directo. Intentando Enter para confirmar...');
            await page.keyboard.press('Enter');
        }

        // HEURÍSTICA: Gatillar el botón "Generar" o "Buscar" si aparece
        await page.evaluate(() => {
            const controls = Array.from(document.querySelectorAll('button, input[type="submit"], a, div.btn'));
            const goBtn = controls.find(c => {
                const t = (c.innerText || c.value || '').toLowerCase();
                const keywords = ['buscar', 'generar', 'consultar', 'ver reporte', 'refresh', 'actualizar', 'view'];
                return keywords.some(k => t.includes(k)) && c.offsetParent !== null;
            });
            if (goBtn) goBtn.click();
        });
        await new Promise(r => setTimeout(r, 4000));


        // 5. Búsqueda exhaustiva en frames
        console.log('Buscando tabla de datos...');

        let targetFrame = null;
        let foundTable = false;
        const startTime = Date.now();

        while (Date.now() - startTime < 60000) {
            const pages = await browser.pages();
            for (const p of pages) {
                const frames = [p.mainFrame(), ...p.frames()];
                for (const frame of frames) {
                    try {
                        const score = await frame.evaluate(() => {
                            const tables = Array.from(document.querySelectorAll('table'));
                            // Buscamos una tabla que tenga palabras clave de transporte
                            return tables.some(t => {
                                const txt = t.innerText.toLowerCase();
                                const hasTotal = txt.includes('total d') || txt.includes('total d\u00EDa') || txt.includes('pasajer');
                                const hasMobile = txt.includes('interno') || txt.includes('unidad') || txt.includes('m\u00F3vil') || txt.includes('placa');
                                return hasTotal && hasMobile;
                            });
                        });
                        if (score) {
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
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 350));
            throw new Error(`Datos no hallados. Asegúrate de estar en el reporte. Vista: "${pageSnapshot}..."`);
        }

        console.log(`Tabla localizada. Extrayendo...`);

        const vehicles = await targetFrame.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            let bestData = [];
            let bestScore = -1;

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length < 2) continue;

                let colIdx = { interno: -1, total: -1, placa: -1 };

                // 1. Localizar cabeceras
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());
                    if (colIdx.total === -1) colIdx.total = cells.findIndex(t => t.includes('total d') || t.includes('total d\u00EDa'));
                    if (colIdx.interno === -1) colIdx.interno = cells.findIndex(t => t.includes('interno') || t.includes('unidad') || t.includes('m\u00F3vil'));
                    if (colIdx.placa === -1) colIdx.placa = cells.findIndex(t => t.includes('placa'));
                }

                if (colIdx.total !== -1) {
                    const currentTableData = [];
                    const idIdx = colIdx.interno !== -1 ? colIdx.interno : colIdx.placa;

                    for (let j = 0; j < rows.length; j++) {
                        const cells = Array.from(rows[j].querySelectorAll('td'));
                        if (cells.length > Math.max(idIdx, colIdx.total)) {
                            const idRaw = cells[idIdx].innerText.trim();
                            const paxRaw = cells[colIdx.total].innerText.trim();

                            const id = idRaw.replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');
                            const val = parseInt(paxRaw.replace(/\D/g, ''));

                            if (id && !isNaN(val) && (val < 2024 || val > 2030)) {
                                if (!currentTableData.find(v => v.identifier === id)) {
                                    currentTableData.push({ identifier: id, pasajeros: val.toString() });
                                }
                            }
                        }
                    }

                    // Puntuación: cuántos vehículos tienen más de 0 pasajeros
                    const score = currentTableData.filter(d => d.pasajeros !== "0").length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestData = currentTableData;
                    }
                }
            }

            // Heurística visual (por si fallan los nombres de columnas)
            if (bestData.length === 0) {
                for (const table of tables) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    const hData = [];
                    rows.forEach(r => {
                        const cs = Array.from(r.querySelectorAll('td'));
                        if (cs.length >= 9) {
                            const id = cs[3].innerText.trim().replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');
                            const pax = parseInt(cs[8].innerText.replace(/\D/g, ''));
                            if (id && !isNaN(pax) && (pax < 2024 || pax > 2030)) {
                                if (!hData.find(v => v.identifier === id)) hData.push({ identifier: id, pasajeros: pax.toString() });
                            }
                        }
                    });
                    if (hData.length > bestData.length) bestData = hData;
                }
            }

            return bestData;
        });

        if (!vehicles || vehicles.length === 0) {
            throw new Error(`Reporte cargado pero no se detectaron vehículos.`);
        }

        console.log(`Extracción exitosa: ${vehicles.length} móviles.`);
        setTimeout(() => browser.close(), 2000);
        res.json({ success: true, vehicles });

    } catch (error) {
        console.error('Error del robot:', error);
        if (browser) await browser.close();
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Robot GPS listo en puerto ${PORT}`);
});
