# Mi Ganancia — Control diario de conductor

Aplicación web (PWA) para que un conductor calcule sus ganancias del día, los gastos y la entrega al propietario del vehículo. Funciona en el celular y guarda los datos en el propio teléfono.

## Qué incluye

- **Cálculo del día:** pasajeros, valor del pasaje, comisión fija y por pasajero, ruta (60 / 29) y gastos.
- **Historial** de registros, con meta mensual de pasajeros y copia para WhatsApp.
- **Resumen** de 7 días / mes / todo, con gráfico de la ganancia diaria.
- **Mantenimiento** del vehículo (con aviso del cambio de aceite) y **documentos** con alertas de vencimiento.
- **Respaldo:** descarga, comparte y restaura todos tus datos desde un archivo.
- **Pasajeros GPS:** consulta al robot (`server/robot.js`) los pasajeros de cada bus.
- Modo oscuro y claro.

## Cómo correrla

```bash
npm install
npm run dev      # app en http://localhost:5173
npm run build    # genera la carpeta dist/
```

El robot GPS (opcional, solo para el botón “Pasajeros GPS”) se inicia con `npm start` en el puerto 3001.

## Estructura

```
src/
  main.tsx, App.tsx        arranque y pantalla principal
  styles.css               paleta (claro/oscuro), animaciones
  types.ts, constants.ts   tipos y valores fijos (claves de almacenamiento, rutas, etc.)
  utils/                   cálculos, formatos, rutas, periodos, mantenimiento, almacenamiento
  hooks/                   usePersistentState, useTheme, useGpsRobot, useKeyboardOpen
  services/gps.ts          llamada al robot
  components/
    ui.tsx                 piezas reutilizables (tarjetas, botones, ventanas)
    layout/                encabezado, barra de acciones, aviso, reloj
    form/                  formulario del día
    summary/               resumen por periodo y meta mensual
    history/               historial
    maintenance/           mantenimiento
    documents/             documentos
    backup/                respaldo de datos
    robot/                 ventana y cápsula del GPS
server/robot.js            robot (Express + Puppeteer)
```

## Despliegue

Cada push a `main` publica la app en GitHub Pages (`.github/workflows/deploy.yml`). El robot se despliega con el `Dockerfile`.
