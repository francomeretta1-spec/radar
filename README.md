# Radar — Consulta de riesgo crediticio con informe de IA

Trabajo Final Integrador · Diplomatura en IA Aplicada a Entornos Digitales de Gestión · FCE-UBA · Cohorte 2026

**App en producción:** [radar-sag.vercel.app](https://radar-sag.vercel.app/)

## ¿Qué hace?

Radar es una aplicación web que, a partir de un CUIT, consulta en simultáneo:

- **BCRA** (Central de Deudores): situación crediticia actual e histórica (24 meses) por entidad financiera, y cheques rechazados.
- **ARCA**: estado de la clave fiscal, actividad económica, categoría de Monotributo, y la base de contribuyentes apócrifos.

Con toda esa información ya relevada, un botón **"Generar informe con IA"** arma un resumen ejecutivo en lenguaje claro —resumen, puntos de atención, puntos a favor y una recomendación— para que un analista de créditos o tesorería tome una decisión informada más rápido, sin cruzar manualmente cada tabla. Todo se puede exportar a PDF.

## ¿Para quién es?

Pensada para el trabajo diario de un **área de créditos o tesorería**: antes de operar con un cliente o proveedor nuevo, hoy ese análisis implica entrar a varios sitios distintos (BCRA, ARCA, cheques) y cruzar los datos a mano. Radar junta todo en una sola pantalla y le suma una lectura en lenguaje natural, sin reemplazar el criterio profesional de quien decide.

## Qué muestra la pantalla

- Situación oficial del BCRA y score propio (ponderado por monto adeudado, no solo la peor situación).
- Datos fiscales de ARCA: estado de clave, actividad, Monotributo, impuestos activos.
- Verificación de apócrifos, con alerta si el CUIT está limitado o publicado.
- Detalle de deuda por entidad financiera, con gráfico de distribución y evolución de los últimos 24 meses.
- Cheques rechazados, con resumen por tipo y por banco.
- Informe generado por IA, bajo demanda.
- Exportación de todo a PDF.

## Fuentes de datos

- **BCRA** — API pública de la Central de Deudores, consultada de forma directa.
- **ARCA** — no se consulta de forma directa: se obtiene a través de **[Arcanum](https://github.com/francomeretta1-spec/arcanum-1)**, un servicio desarrollado por el profesor **Diego Parras** que expone los webservices de ARCA (padrón, Monotributo, apócrifos) de forma más simple que integrarlos en crudo. Para este proyecto se desplegó una instancia propia de Arcanum en **Railway**.
  - Durante la integración se detectó un bug real en la verificación de apócrifos de Arcanum (devolvía siempre error). Se diagnosticó y corrigió con ChatGPT, y el fix se envió como Pull Request al repositorio original.

## Herramientas de IA utilizadas

| Herramienta | Uso en el proyecto |
|---|---|
| **Claude (Anthropic)** | "Vibe coding" — desarrollo completo de la aplicación (Next.js/TypeScript), iteración de gráficos y de la integración del informe con IA. |
| **Google Gemini 3.1 Flash Lite** | Motor que genera el informe de riesgo crediticio, a partir de los datos ya relevados del CUIT. Elegido por su cuota gratuita (500 solicitudes/día). |
| **ChatGPT (OpenAI)** | Diagnóstico y corrección del bug de Arcanum mencionado arriba. |
| **OpenRouter** | Proveedor alternativo configurado como respaldo, sin necesidad de cambiar código. |

## Stack técnico

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Recharts** para los gráficos
- **Supabase** para autenticación
- **Vercel** para el despliegue de la app, **Railway** para el de Arcanum

## Cómo se usa

1. Se ingresa un CUIT en el buscador.
2. La app consulta BCRA y Arcanum (ARCA) y arma el panel de resultados.
3. Con el botón **"Generar informe con IA"** se genera el resumen ejecutivo — apoyo informativo, la decisión final es del usuario.
4. Se puede descargar todo como PDF.

### Configuración de la IA

La app funciona sin pedirle nada al usuario si el servidor tiene una API Key configurada (variables `GEMINI_API_KEY`, `RADAR_AI_DEFAULT_PROVIDER=gemini`). Si no está configurada, cae automáticamente a un formulario donde cualquiera puede cargar su propia key solo para esa consulta, sin que quede guardada en ningún lado.

## Historial de versiones

1. **v1 — Consulta base**: integración con BCRA y Arcanum, panel de resultados, exportación a PDF.
2. **v2 — Visualización de deuda**: iteración de gráfico de torta → treemap → barras horizontales, hasta encontrar el formato más legible.
3. **v3 — Informe con IA**: botón de informe generado por IA, arquitectura multi-proveedor y manejo seguro de API Keys.
4. **v4 — Modelo gratuito por defecto**: comparación de cuotas gratuitas y elección de Gemini 3.1 Flash Lite en producción.
5. **Corrección en Arcanum**: bug de la verificación de apócrifos, corregido con ChatGPT y enviado como Pull Request.

Más detalle del proceso y las decisiones de diseño: ver el informe del TP (`Trabajo_Final_Integrador_Radar.docx`).

## Créditos

Desarrollado por Franco Meretta — Contador — como Trabajo Final Integrador de la Diplomatura en IA Aplicada a Entornos Digitales de Gestión (FCE-UBA, Cohorte 2026).

Los datos de ARCA se obtienen a través de [Arcanum](https://github.com/francomeretta1-spec/arcanum-1), desarrollado por el profesor Diego Parras.
