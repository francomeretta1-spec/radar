Radar — Consulta de riesgo crediticio con informe de IA
Trabajo Final Integrador · Diplomatura en IA Aplicada a Entornos Digitales de Gestión · FCE-UBA · Cohorte 2026
¿Qué hace?
Radar es una aplicación web que, a partir de un CUIT, consulta en simultáneo:
BCRA (Central de Deudores): situación crediticia actual e histórica (24 meses), desglosada por entidad financiera, y cheques rechazados.
ARCA: estado de la clave fiscal, actividad económica, categoría de Monotributo, y la base de contribuyentes apócrifos (WSAPOC).
Con toda esa información ya relevada, un botón "Generar informe con IA" arma un resumen ejecutivo en lenguaje claro — resumen, puntos de atención, puntos a favor y una recomendación — para que un analista de créditos o tesorería tome una decisión informada más rápido, sin tener que leer y cruzar manualmente cada tabla.
El informe completo también se puede exportar a PDF.
¿Para quién es?
Pensada para el trabajo diario de un área de créditos o tesorería: antes de operar con un cliente o proveedor nuevo (otorgar una línea de crédito, aceptar un cheque, fijar condiciones de pago), hoy ese análisis implica entrar a 3-4 sitios distintos (BCRA, ARCA, consulta de cheques) y cruzar los datos a mano. Radar junta todo en una sola pantalla y le suma una lectura en lenguaje natural.
Herramientas de IA utilizadas
Herramienta	Uso en el proyecto
Claude (Anthropic), vía chat con acceso a un entorno de desarrollo	"Vibe coding" — desarrollo completo de la aplicación Radar (Next.js/TypeScript) conversando en lenguaje natural: diseño de componentes, corrección de bugs, iteración de gráficos, integración de APIs externas y del propio proveedor de IA.
Google Gemini 3.1 Flash Lite (vía API, capa gratuita de Google AI Studio)	Motor que genera el informe de riesgo crediticio dentro de la app, a partir de los datos ya relevados del CUIT consultado.
ChatGPT (OpenAI)	Diagnóstico y corrección de un bug en Arcanum (servicio externo del que depende Radar para los datos de ARCA — ver más abajo): la consulta de apócrifos (WSAPOC) devolvía siempre error, incluso para CUITs efectivamente publicados. El fix se envió como Pull Request al repositorio original.
OpenRouter	Gateway alternativo, configurado como respaldo para poder usar otros modelos (gratuitos o pagos) sin cambiar código.
Fuentes de datos
BCRA — API pública de la Central de Deudores, consultada de forma directa.
ARCA — vía Arcanum, un servicio desarrollado por el profesor Diego Parras que expone el padrón de contribuyentes, Monotributo y la base de apócrifos (WSAPOC) de forma más simple que integrar directamente los webservices SOAP de ARCA. Para este proyecto se desplegó una instancia propia de Arcanum en Railway.
Stack técnico
Next.js 16 (App Router) + TypeScript + Tailwind
Recharts para los gráficos (evolución de deuda, distribución por entidad)
Supabase para autenticación
Vercel para el despliegue
APIs públicas de BCRA (Central de Deudores) y ARCA (padrón, Monotributo, apócrifos)
Cómo se usa
Se ingresa un CUIT en el buscador.
La app consulta BCRA y ARCA en paralelo y arma un panel con: situación crediticia oficial, score propio ponderado por monto, detalle por entidad financiera, evolución de los últimos 24 meses, cheques rechazados y verificación de apócrifos.
Con el botón "Generar informe con IA", se genera un resumen ejecutivo con recomendación (apoyo informativo — la decisión final queda siempre del lado del usuario).
Se puede descargar todo como PDF.
Configuración de la IA (variables de entorno)
La app funciona sin pedirle nada al usuario si el servidor tiene configurada una API Key. Variables relevantes (en Vercel → Settings → Environment Variables):
```
GEMINI\_API\_KEY=tu-api-key-de-google-ai-studio
RADAR\_AI\_DEFAULT\_PROVIDER=gemini
GEMINI\_MODEL=gemini-3.1-flash-lite
```
Si esas variables no están configuradas, la app no falla: cae automáticamente a un formulario donde cualquier usuario puede cargar su propia API Key (de OpenRouter, OpenAI, Anthropic o Gemini) solo para esa consulta puntual, sin que quede guardada en ningún lado.
Historial de versiones (evolución del proyecto)
Este repo refleja el proceso real de construcción, no una versión final "de una sola vez":
v1 — Consulta base: integración con BCRA y ARCA, panel de resultados, exportación a PDF.
v2 — Visualización de deuda por entidad: iteración de gráfico de torta → treemap → barras horizontales, hasta encontrar el formato más legible para comparar varios bancos a la vez.
v3 — Informe con IA: incorporación del botón de informe generado por IA, con arquitectura multi-proveedor (OpenRouter / OpenAI / Anthropic / Gemini / endpoint custom) y manejo seguro de API Keys (nunca persistidas del lado del cliente).
v4 — Modelo gratuito por defecto: se evaluaron distintos modelos gratuitos según cuota diaria disponible, y se configuró Gemini 3.1 Flash Lite (500 solicitudes/día gratis) como proveedor por defecto en producción.
Corrección en Arcanum: durante la integración se detectó que la verificación de apócrifos (WSAPOC) fallaba siempre en el servicio Arcanum del que depende Radar para los datos de ARCA. Se diagnosticó y corrigió con ayuda de ChatGPT, y el fix se envió como Pull Request al repositorio de Arcanum.
Créditos
Desarrollado por Franco Meretta — Contador — como Trabajo Final Integrador de la Diplomatura en IA Aplicada a Entornos Digitales de Gestión (FCE-UBA, Cohorte 2026).
