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

        // ESTRATEGIA PRINCIPAL: Buscar directamente el sub-reporte.
        let targetReport = await page.evaluate(() => {
            const keywords = ['producción por vehículo', 'produccion', 'vehículo', 'vehiculo', 'móviles', 'moviles'];
            const elements = Array.from(document.querySelectorAll('a, span, div, li'));
            return elements.find(el => {
                const text = (el.innerText || '').toLowerCase();
                return keywords.some(k => text.includes(k)) && el.innerText.length < 50; // Evitar textos largos
            });
        });

        if (targetReport) {
            console.log('Reporte encontrado directamente. Clickeando...');
            await page.evaluate(el => el.click(), targetReport);
        } else {
            console.log('Reporte directo no visible. Interactuando con menú "Reportes"...');

            // 1. Encontrar menú "Reportes"
            const reportMenuHandle = await page.evaluateHandle(() => {
                const all = Array.from(document.querySelectorAll('a, span, div, li'));
                return all.find(el => el.innerText.trim().toLowerCase() === 'reportes');
            });

            if (reportMenuHandle && reportMenuHandle.asElement()) {
                // 2. Intentar Hover (común en menús dropdown)
                await reportMenuHandle.hover();
                await new Promise(r => setTimeout(r, 1000));

                // 3. Intentar Clic
                await reportMenuHandle.click();
                await new Promise(r => setTimeout(r, 2000));

                // 4. Buscar ahora el sub-link
                const clickedSub = await page.evaluate(() => {
                    const subKeywords = ['producción', 'produccion', 'vehículo', 'vehiculo'];
                    const subElements = Array.from(document.querySelectorAll('a, span, div, li'));
                    const subTarget = subElements.find(el => {
                        const text = (el.innerText || '').toLowerCase();
                        // Debe ser visible y contener la palabra clave
                        return subKeywords.some(k => text.includes(k)) && el.offsetParent !== null;
                    });

                    if (subTarget) {
                        subTarget.click();
                        return true;
                    }
                    return false;
                });

                if (clickedSub) {
                    console.log('Sub-reporte clickeado tras abrir menú.');
                } else {
                    console.log('Aún no se encuentra "Producción". Intentando URL directa o fallback...');
                }
            }
        }

        await new Promise(r => setTimeout(r, 4000)); // Esperar carga de la vista de reporte

        // HEURÍSTICA: Buscar botón "Generar" o "Buscar"
        console.log('Buscando botón Generar/Buscar...');
        await page.evaluate(() => {
            const controls = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, div.btn'));
            const goBtn = controls.find(c => {
                const t = (c.innerText || c.value || '').toLowerCase();
                return ['generar', 'buscar', 'consultar', 'ver', 'search'].some(k => t.includes(k));
            });
            if (goBtn) goBtn.click();
        });
        // Espera larga para que llegue la data (AJAX)
        await new Promise(r => setTimeout(r, 6000));


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
                                const hasTotal = txt.includes('total d') || txt.includes('total d\u00EDa') || txt.includes('pasajer') || txt.includes('pax');
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
            const pageSnapshot = await page.evaluate(() => {
                // Capturar una instantánea de texto de lo que ve el robot para debug
                const bodyText = document.body.innerText.replace(/\n+/g, ' | ').substring(0, 500);
                const links = Array.from(document.querySelectorAll('a')).map(a => a.innerText).slice(0, 5).join(', ');
                return `Texto: ${bodyText} ... Links: ${links}`;
            });
            throw new Error(`Datos no hallados. El robot ve esto: "${pageSnapshot}"`);
        }

        console.log(`Tabla localizada. Extrayendo...`);

        const vehicles = await targetFrame.evaluate(() => {
            // 1. Intentar con Tablas (Prioridad Alta)
            const tables = Array.from(document.querySelectorAll('table'));
            let bestData = [];

            for (const table of tables) {
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length < 2) continue;

                let headerIndex = -1;
                let colIndices = { placa: -1, interno: -1, total: -1 };

                // Buscar headers
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const headerCells = Array.from(rows[i].querySelectorAll('td, th'));
                    const texts = headerCells.map(c => c.innerText.trim().toLowerCase());

                    const idxTotal = texts.findIndex(t => t.includes('total d') || t.includes('total d\u00EDa') || t.includes('pasajer') || t.includes('pax'));
                    const idxInterno = texts.findIndex(t => t.includes('interno') || t.includes('unidad') || t.includes('m\u00F3vil'));
                    const idxPlaca = texts.findIndex(t => t.includes('placa'));

                    if (idxTotal !== -1 || idxInterno !== -1 || idxPlaca !== -1) {
                        headerIndex = i;
                        colIndices.total = idxTotal;
                        colIndices.placa = idxPlaca;
                        colIndices.interno = idxInterno;
                        break;
                    }
                }

                // Si fallan cabeceras, probar columnas por posición (3 y 8 son comunes en estos reportes)
                const useHeuristic = (headerIndex === -1 && rows.some(r => r.querySelectorAll('td').length > 8));
                const data = [];
                const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

                for (let j = startRow; j < rows.length; j++) {
                    const cells = Array.from(rows[j].querySelectorAll('td'));
                    if (cells.length < 4) continue;

                    let interno = '';
                    let pasajeros = '';

                    if (headerIndex !== -1) {
                        if (colIndices.interno !== -1 && cells[colIndices.interno]) {
                            interno = cells[colIndices.interno].innerText.trim();
                        } else if (colIndices.placa !== -1 && cells[colIndices.placa]) {
                            interno = cells[colIndices.placa].innerText.trim();
                        }

                        if (colIndices.total !== -1 && cells[colIndices.total]) {
                            pasajeros = cells[colIndices.total].innerText.trim();
                        }
                    } else if (useHeuristic) {
                        // Asumimos layout estandar si no hay headers
                        interno = cells[3] ? cells[3].innerText.trim() : '';
                        pasajeros = cells[8] ? cells[8].innerText.trim() : '';
                    }

                    // Limpieza
                    interno = interno.replace(/^N0*/i, '').replace(/^M/i, '').replace(/^0+/, '');
                    const val = parseInt(pasajeros.replace(/\D/g, ''));

                    // Filtro estricto anti-fechas y anti-direcciones
                    if (pasajeros.includes(':') || pasajeros.includes('-') || (val > 2024 && val < 2030)) {
                        pasajeros = '';
                    }

                    if (interno && !isNaN(val)) {
                        if (!data.find(v => v.identifier === interno)) {
                            data.push({ identifier: interno, pasajeros: val.toString() });
                        }
                    }
                }
                if (data.length > bestData.length) bestData = data;
            }

            if (bestData.length > 0) return bestData;

            // ESTRATEGIA 2: TEXT SCRAPING (Plan B - Reforzado)
            // Si las tablas fallan, buscamos patrones de texto crudo
            const text = document.body.innerText;
            const results = [];
            // Buscamos patrones como "M-045" o "Int 45" o simplemente tablas de texto

            // Regex para identificar IDs de moviles (1 a 4 digitos, a veces con prefijo)
            const internalMatches = [...text.matchAll(/\b(?:N|M|Movil|Int|No|Placa)?[-.\s]?(\d{1,4})\b/gi)];

            for (const match of internalMatches) {
                const internoNum = match[1].replace(/^0+/, '');
                // Mirar adelante unos 200 caracteres para encontrar el conteo
                const lookahead = text.substring(match.index, match.index + 200);

                // Buscar números que NO sean el mismo ID, ni fechas, ni direcciones
                const numberMatches = [...lookahead.matchAll(/\b(\d+)\b/g)];

                for (const nm of numberMatches) {
                    const numStr = nm[1];
                    const n = parseInt(numStr);

                    // Filtros
                    const isSame = numStr === match[1];
                    const isDate = (n >= 2024 && n <= 2030); // Años recientes
                    const isTime = nm.input.substring(nm.index - 1, nm.index) === ':' || nm.input.substring(nm.index + numStr.length, nm.index + numStr.length + 1) === ':';

                    if (!isSame && !isDate && !isTime && n >= 0 && n < 2000) {
                        // Asumimos que es el pasaje si está cerca y valida
                        const exists = results.find(r => r.identifier === internoNum);
                        if (!exists) {
                            results.push({ identifier: internoNum, pasajeros: n.toString() });
                        }
                        break; // Tomamos el primer número apto como pasajeros
                    }
                }
            }
            return results;
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
