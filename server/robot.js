
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

        // 4. Navegar a Rastreo -> Moviles
        console.log('Buscando menu Rastreo...');
        await new Promise(r => setTimeout(r, 2000));

        // Intentar click en Rastreo
        const menuClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const rastreo = elements.find(el => el.innerText && el.innerText.trim() === 'Rastreo');
            if (rastreo) {
                rastreo.click();
                return true;
            }
            return false;
        });

        await new Promise(r => setTimeout(r, 1000));

        // Intentar click en Móviles
        const movilesClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const moviles = elements.find(el => el.innerText && (el.innerText.includes('Móviles') || el.innerText.includes('Moviles')));
            if (moviles) {
                moviles.click();
                return true;
            }
            return false;
        });

        if (!movilesClicked) throw new Error("No se encontró el botón 'Móviles'.");

        // 5. Esperar Tabla y Extraer
        console.log('Esperando tabla de resultados...');
        await page.waitForSelector('table', { timeout: 30000 });

        const vehicles = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'));
            let headerIndex = -1;
            let colIndices = { placa: -1, interno: -1, total: -1 };

            rows.some((row, idx) => {
                const text = row.innerText.toLowerCase();
                // Buscar encabezado por keywords
                if (text.includes('total') && (text.includes('dia') || text.includes('día'))) {
                    headerIndex = idx;
                    const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.innerText.trim().toLowerCase());
                    colIndices.total = cells.findIndex(c => c.includes('total') && (c.includes('dia') || c.includes('día')));
                    colIndices.placa = cells.findIndex(c => c.includes('placa'));
                    colIndices.interno = cells.findIndex(c => c.includes('interno') || c.includes('movil') || c.includes('móvil'));
                    return true;
                }
                return false;
            });

            if (headerIndex === -1) return null;

            const data = [];
            for (let i = headerIndex + 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length <= colIndices.total) continue; // Skip si no tiene suficientes columnas

                const interno = colIndices.interno !== -1 ? cells[colIndices.interno].innerText.trim() : '?';
                const placa = colIndices.placa !== -1 ? cells[colIndices.placa].innerText.trim() : '?';
                const pasajeros = cells[colIndices.total].innerText.trim();

                let identifier = placa;
                // Si existe interno, úsalo, salvo que sea vacío
                if (interno && interno.length > 0 && interno !== '0') {
                    identifier = interno;
                }

                if (pasajeros) {
                    data.push({ identifier, pasajeros });
                }
            }
            return data;
        });

        if (!vehicles) throw new Error("No se encontraron datos en la tabla (estructura desconocida).");

        console.log(`Encontrados ${vehicles.length} vehículos.`);

        // Mantener navegador brevemente abierto para debug
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
