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

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        // 4. Navegación Inteligente
        console.log('Buscando ruta a datos...');
        await new Promise(r => setTimeout(r, 2000));

        // ESTRATEGIA PRINCIPAL: Buscar acceso directo a "Rep. Hoy" (Reporte Hoy)
        // El log de error muestra que este elemento existe y es probable que tenga la tabla.
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
            console.log('Click exitoso en "Rep. Hoy". Esperando reporte...');
            // Esperar a que cargue el reporte
            await new Promise(r => setTimeout(r, 3000));
        } else {
            console.log('"Rep. Hoy" no visible, intentando ruta clásica Rastreo -> Móviles...');

            // INTENTO 2: Rastreo -> Móviles (Legacy)
            console.log('Buscando menu Rastreo...');

            // Estrategia de Clic Mejorada: Click solo en elementos interactivos
            const menuClicked = await page.evaluate(() => {
                const selectors = ['a', 'div[role="button"]', 'span', 'div'];
                for (const selector of selectors) {
                    const elements = Array.from(document.querySelectorAll(selector));
                    const rastreo = elements.find(el => el.innerText && el.innerText.trim() === 'Rastreo');
                    if (rastreo && rastreo.offsetParent !== null) {
                        rastreo.click();
                        return true;
                    }
                }
                return false;
            });

            await new Promise(r => setTimeout(r, 1000));

            const movilesClicked = await page.evaluate(() => {
                const selectors = ['a', 'div[role="button"]', 'span', 'div', 'li'];
                for (const selector of selectors) {
                    const elements = Array.from(document.querySelectorAll(selector));
                    const moviles = elements.find(el => {
                        const text = (el.innerText || '').toLowerCase();
                        return text.includes('móviles') || text.includes('moviles');
                    });
                    if (moviles && moviles.offsetParent !== null) {
                        moviles.click();
                        return true;
                    }
                }
                return false;
            });

            if (!movilesClicked && !menuClicked) {
                const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
                throw new Error(`No se encontró menú 'Rastreo' ni 'Rep. Hoy'. ¿Cambió la página? Info: ${bodyText}`);
            }
        }

        // HEURÍSTICA: Buscar botón "Generar" o "Buscar" por si hay filtro previo
        console.log("Buscando botón de confirmación secundario...");
        try {
            await new Promise(r => setTimeout(r, 2000));
            const actionClicked = await page.evaluate(() => {
                const keywords = ['buscar', 'generar', 'consultar', 'ver reporte', 'refresh', 'actualizar'];
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, div.btn'));

                const actionBtn = buttons.find(b => {
                    const text = (b.innerText || b.value || '').toLowerCase();
                    return keywords.some(k => text.includes(k));
                });

                if (actionBtn && actionBtn.offsetParent !== null) {
                    actionBtn.click();
                    return true;
                }
                return false;
            });
            if (actionClicked) console.log("Botón secundario clickeado.");
        } catch (e) { console.log("No se requirió acción secundaria."); }


        // 5. Esperar Tabla y Extraer (Soporte Universal)
        console.log('Esperando resultados...');

        let targetFrame = null;
        let foundTable = false;
        const startTime = Date.now();

        // Bucle de búsqueda (60 segundos)
        while (Date.now() - startTime < 60000) {
            const pages = await browser.pages();

            for (const p of pages) {
                const frames = [p.mainFrame(), ...p.frames()];
                for (const frame of frames) {
                    // 1. Buscar Tabla Standard
                    try {
                        const table = await frame.$('table');
                        if (table) {
                            const rowCount = await frame.evaluate(el => el.querySelectorAll('tr').length, table);
                            if (rowCount > 2) {
                                targetFrame = frame;
                                foundTable = true;
                                break;
                            }
                        }
                    } catch (e) { }

                    // 2. Buscar patrón de texto "Placa - Interno" (Plan B)
                    if (!foundTable) {
                        try {
                            const hasVehicles = await frame.evaluate(() => {
                                const text = document.body.innerText;
                                return /[A-Z]{3}\d{3}/.test(text) && (/ - N\d+/.test(text) || /Movil\s*\d+/.test(text));
                            });
                            if (hasVehicles) {
                                targetFrame = frame;
                                // No break, seguimos buscando tabla idealmente, pero ya tenemos un candidato
                            }
                        } catch (e) { }
                    }
                }
                if (foundTable) break;
            }
            if (foundTable) break;
            await new Promise(r => setTimeout(r, 2000));
        }

        // Si no hay frame targeteado, error
        if (!targetFrame) {
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 300));
            throw new Error(`No se encontraron datos. Vista: "${pageSnapshot}..."`);
        }

        console.log(`Fuente de datos encontrada en: ${targetFrame.url()}`);

        const vehicles = await targetFrame.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'));

            // 1. Identificar índices de columnas
            let headerIndex = -1;
            let colIndices = { placa: -1, interno: -1, total: -1 };

            // Buscar la fila de encabezado exacta basada en la imagen del usuario
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());

                // Indices basados en "Total dia" y "Número interno"
                const idxTotal = cells.findIndex(c => c.includes('total dia') || c.includes('total día'));
                const idxInterno = cells.findIndex(c => c.includes('número interno') || c.includes('numero interno') || c.includes('interno'));
                const idxPlaca = cells.findIndex(c => c.includes('placa'));

                if (idxTotal !== -1 && (idxInterno !== -1 || idxPlaca !== -1)) {
                    headerIndex = i;
                    colIndices.total = idxTotal;
                    colIndices.placa = idxPlaca;
                    colIndices.interno = idxInterno;
                    break;
                }
            }

            if (headerIndex === -1 && rows.length > 2) {
                // Fallback: Si no hallamos headers, intentar adivinar por contenido (evitando fechas)
                // Pero con la imagen clara, deberíamos encontrar el header.
                return [];
            }

            if (headerIndex !== -1) {
                const data = [];
                for (let i = headerIndex + 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    if (cells.length <= colIndices.total) continue;

                    let interno = colIndices.interno !== -1 ? cells[colIndices.interno].innerText.trim() : '';
                    // Limpiar interno: N015 -> 015
                    interno = interno.replace(/^N0*/i, '').replace(/^M/i, '');

                    let placa = colIndices.placa !== -1 ? cells[colIndices.placa].innerText.trim() : '';

                    // Preferir interno si existe
                    let identifier = interno || placa;

                    // Extraer Total
                    let pasajeros = cells[colIndices.total].innerText.trim();

                    // Validación extra: Que no sea una fecha (2026)
                    if (pasajeros.includes('-') || pasajeros.includes(':')) continue;

                    // Intentar limpiar número
                    const numPasajeros = parseInt(pasajeros.replace(/\D/g, ''));

                    if (identifier && !isNaN(numPasajeros)) {
                        // Evitar duplicados si la fila se repite
                        const exists = data.find(v => v.identifier === identifier);
                        if (!exists) {
                            data.push({ identifier, pasajeros: numPasajeros.toString() });
                        }
                    }
                }
                return data;
            }
            return [];
        });

        if (!vehicles || vehicles.length === 0) {
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 300));
            throw new Error(`Tabla encontrada pero sin datos legibles. Headers no hallados? Texto: "${pageSnapshot}..."`);
        }

        console.log(`Encontrados ${vehicles.length} vehículos.`);
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
