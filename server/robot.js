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

        const vehicles = await targetFrame.evaluate(async () => {
            // ESTRATEGIA 1: Tabla HTML
            const rows = Array.from(document.querySelectorAll('tr'));
            if (rows.length > 2) {
                // ... Tabla logic ...
                let headerIndex = -1;
                let colIndices = { placa: -1, interno: -1, total: -1 };

                for (let i = 0; i < Math.min(rows.length, 8); i++) {
                    const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());

                    // Keywords
                    const idxTotal = cells.findIndex(c => c.includes('total') || c.includes('pasajeros') || c.includes('pax') || c.includes('cant') || c.includes('conteo'));
                    const idxPlaca = cells.findIndex(c => c.includes('placa'));
                    const idxInterno = cells.findIndex(c => c.includes('interno') || c.includes('movil') || c.includes('móvil') || c.includes('unidad'));

                    if (idxPlaca !== -1 || idxInterno !== -1) {
                        headerIndex = i;
                        colIndices.total = idxTotal;
                        colIndices.placa = idxPlaca;
                        colIndices.interno = idxInterno;
                        break;
                    }
                }

                if (headerIndex !== -1 || rows.length > 3) {
                    // Si encontramos headers o la tabla es grande, intentamos parsear
                    const data = [];
                    const startRow = headerIndex === -1 ? 0 : headerIndex + 1;

                    for (let i = startRow; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length < 2) continue;

                        let interno = colIndices.interno !== -1 && cells[colIndices.interno] ? cells[colIndices.interno].innerText.trim() : '';
                        let placa = colIndices.placa !== -1 && cells[colIndices.placa] ? cells[colIndices.placa].innerText.trim() : '';

                        // Fallback columns si no hay headers
                        if (headerIndex === -1) {
                            // Asumir col 0 o 1 es identificador
                            const t0 = cells[0].innerText.trim();
                            if (t0.length > 3) placa = t0;
                        }

                        let identifier = placa || interno || 'Desconocido';
                        if (interno && interno.length > 0 && interno !== '0') identifier = interno;

                        let pasajeros = '0';
                        if (colIndices.total !== -1 && cells[colIndices.total]) {
                            pasajeros = cells[colIndices.total].innerText.trim();
                        } else {
                            // Heurística numérica
                            for (const cell of cells) {
                                const val = parseInt(cell.innerText.replace(/\D/g, ''));
                                // Asumimos que un bus lleva entre 10 y 2000 personas/día
                                if (!isNaN(val) && val > 10 && val < 5000) {
                                    pasajeros = cell.innerText.trim();
                                    break;
                                }
                            }
                        }
                        if (identifier !== 'Desconocido') data.push({ identifier, pasajeros });
                    }
                    if (data.length > 0) return data;
                }
            }

            // ESTRATEGIA 2: TEXT SCRAPING (Fallback para Listas/Cards)
            const text = document.body.innerText;
            const results = [];
            const lines = text.split('\n');

            // Regex flexible: Placa XXX000 ... N000
            const pattern = /([A-Z]{3}\d{3}).*N?(\d{2,4})/i;

            for (const line of lines) {
                if (line.match(/[A-Z]{3}\d{3}/)) {
                    // Buscar placa
                    const placaMatch = line.match(/([A-Z]{3}\d{3})/);
                    const placa = placaMatch ? placaMatch[1] : '';

                    // Buscar interno (N seguido de digitos o M seguido de digitos, o solo digitos aislados)
                    const internoMatch = line.match(/\b(?:N|M|Movil|Int)[-.\s]?(\d+)/i);
                    const interno = internoMatch ? internoMatch[1] : '';

                    // Buscar pasajeros (Numero > 10 aislado)
                    // Filtramos placa e interno de los numeros encontrados
                    const numbers = line.match(/\b\d+\b/g) || [];
                    let pasajeros = '0';
                    for (const numStr of numbers) {
                        const n = parseInt(numStr);
                        // Criterio: Mayor a 5, menor a 5000, y no es parte de la placa ni es el interno
                        if (n > 5 && n < 5000 && numStr !== interno && !placa.includes(numStr)) {
                            pasajeros = numStr;
                            break;
                        }
                    }

                    if (placa || interno) {
                        results.push({ identifier: interno || placa, pasajeros });
                    }
                }
            }
            return results;
        });

        if (!vehicles || vehicles.length === 0) {
            const pageSnapshot = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').substring(0, 300));
            throw new Error(`Tabla vacía o ilegible. Texto: "${pageSnapshot}..."`);
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
