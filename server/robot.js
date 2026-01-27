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
            // 1. Intentar con Tablas (Prioridad Alta)
            const tables = Array.from(document.querySelectorAll('table'));

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length < 2) continue;

                // Buscar headers en esta tabla o en la tabla anterior (sticky headers)
                let headerIndex = -1;
                let colIndices = { placa: -1, interno: -1, total: -1 };

                // Buscar headers
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());

                    const idxTotal = cells.findIndex(c => c.includes('total d') || c.includes('total d\u00EDa') || (c.includes('total') && c.includes('dia')));
                    const idxInterno = cells.findIndex(c => c.includes('interno') || c.includes('unidad') || c.includes('m\u00F3vil'));
                    const idxPlaca = cells.findIndex(c => c.includes('placa'));

                    if (idxTotal !== -1 || idxInterno !== -1) {
                        headerIndex = i;
                        colIndices.total = idxTotal;
                        colIndices.placa = idxPlaca;
                        colIndices.interno = idxInterno;
                        break;
                    }
                }

                // Si encontramos una tabla con datos pero sin headers, usar HEURÍSTICA DE POSICIÓN
                // Por la imagen: Interno es col 3, Total día es col 8
                const useHeuristic = (headerIndex === -1 && rows.some(r => r.querySelectorAll('td').length > 8));

                const data = [];
                const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

                for (let j = startRow; j < rows.length; j++) {
                    const cells = rows[j].querySelectorAll('td');
                    if (cells.length < 5) continue;

                    let interno = '';
                    let pasajeros = '';

                    if (headerIndex !== -1) {
                        interno = colIndices.interno !== -1 ? cells[colIndices.interno].innerText.trim() : '';
                        pasajeros = colIndices.total !== -1 ? cells[colIndices.total].innerText.trim() : '';
                    } else if (useHeuristic) {
                        // Fallback basado en la estructura visual de la imagen
                        interno = cells[3] ? cells[3].innerText.trim() : '';
                        pasajeros = cells[8] ? cells[8].innerText.trim() : '';
                    }

                    // Limpieza de datos
                    interno = interno.replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');

                    // Si el pasajero parece una dirección o fecha, lo ignoramos
                    const val = parseInt(pasajeros.replace(/\D/g, ''));
                    if (pasajeros.includes(':') || pasajeros.includes('-') || (val > 2020 && val < 2030)) {
                        pasajeros = '';
                    }

                    if (interno && pasajeros && !isNaN(val)) {
                        const exists = data.find(v => v.identifier === interno);
                        if (!exists) {
                            data.push({ identifier: interno, pasajeros: val.toString() });
                        }
                    }
                }
                if (data.length > 0) return data;
            }

            // ESTRATEGIA 2: TEXT SCRAPING MEJORADO
            const text = document.body.innerText;
            const results = [];

            // Buscar TODOS los internos (N015, N034...)
            const internalMatches = [...text.matchAll(/\b(?:N|M|Movil|Int)[-.\s]?(\d{1,4})\b/gi)];

            for (const match of internalMatches) {
                const internoNum = match[1].replace(/^0+/, '');
                const lookahead = text.substring(match.index, match.index + 300);

                // Buscamos el "Total dia" que suele estar después de una dirección o texto largo
                // Filtramos números que parecen direcciones (ej: Ci 21, Cl 19)
                const numbers = lookahead.match(/\b\d+\b/g) || [];

                let foundPasajeros = '';
                for (const numStr of numbers) {
                    const n = parseInt(numStr);

                    // REGLAS ESTRICTAS PARA PASAJEROS:
                    // 1. No es el interno.
                    // 2. No es parte de una dirección común (Ci 21, Cl 19, Cra 10, etc.)
                    const precedingText = lookahead.substring(0, lookahead.indexOf(numStr)).toLowerCase();
                    const isAddress = precedingText.endsWith('ci ') || precedingText.endsWith('cl ') || precedingText.endsWith('cl. ') || precedingText.endsWith('#') || precedingText.endsWith('cra ') || precedingText.endsWith('av ');

                    // 3. No es año ni hora.
                    const isDate = (n > 2024 && n < 2030);

                    if (numStr !== match[1] && !isAddress && !isDate && n >= 0 && n < 5000) {
                        foundPasajeros = numStr;
                        // No rompemos todavía, buscamos si hay un número más adelante que sea el real 
                        // (el total día suele ser de las últimas columnas)
                    }
                }

                if (internoNum && foundPasajeros) {
                    const exists = results.find(r => r.identifier === internoNum);
                    if (!exists) results.push({ identifier: internoNum, pasajeros: foundPasajeros });
                }
            }
            return results;
        });

        if (!vehicles || vehicles.length === 0) {
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 300));
            throw new Error(`Datos no encontrados (ni en tablas ni texto). Inicio: "${pageSnapshot}..."`);
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
