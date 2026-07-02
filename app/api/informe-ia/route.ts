import { NextRequest, NextResponse } from "next/server";
import type { ConsultaCompleta } from "@/lib/api/types";
import { armarContextoParaIA } from "@/lib/risk";

type Proveedor = "openrouter" | "openai" | "anthropic" | "gemini" | "custom";

// Proveedor que se usa cuando el botón "Generar informe con IA" se aprieta
// sin elegir nada (intento automático) — configurable sin tocar código.
const PROVEEDOR_POR_DEFECTO = (process.env.RADAR_AI_DEFAULT_PROVIDER as Proveedor) || "openrouter";

// Si el servidor tiene la key configurada como variable de entorno, se usa
// automáticamente sin pedirle nada al usuario en pantalla. Si el cliente
// manda su propia key (formulario de respaldo), esa tiene prioridad.
const KEY_POR_PROVEEDOR: Record<Proveedor, string | undefined> = {
  openrouter: process.env.OPENROUTER_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  custom: process.env.RADAR_AI_API_KEY,
};
const MODELO_POR_DEFECTO: Record<Proveedor, string> = {
  openrouter: process.env.OPENROUTER_MODEL || "openrouter/free",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
  gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  custom: process.env.RADAR_AI_MODEL || "",
};
const BASE_URL_SERVIDOR = process.env.RADAR_AI_BASE_URL;

const PROMPT_SISTEMA = `Sos un analista de riesgo crediticio argentino. Vas a recibir un resumen de la situación de un CUIT (BCRA, ARCA, cheques rechazados) y tenés que escribir un informe breve en español rioplatense para que un usuario de una fintech/empresa decida si operar o no con esa contraparte.

Reglas:
- Usá SOLO los datos provistos. Nunca inventes cifras, entidades o fechas que no estén en el contexto.
- Estructura el informe en estas secciones, usando "## " para cada título:
  ## Resumen ejecutivo
  ## Puntos de atención
  ## Puntos a favor
  ## Recomendación
- En "Puntos de atención" y "Puntos a favor" usá listas con "- " por ítem.
- En "Recomendación" dá una conclusión clara (ej. "operar con cautela", "sin objeciones", "no recomendable") pero aclarando siempre que es un apoyo informativo y la decisión final es del usuario, no una determinación automática.
- No uses markdown más allá de "## " y "- " (nada de negritas, tablas ni links).
- Sé conciso: el informe completo no debería superar las 300 palabras.`;

function construirRequest(proveedor: Proveedor, model: string, contexto: string, apiKey: string, baseUrl?: string) {
  if (proveedor === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: 1024,
        system: PROMPT_SISTEMA,
        messages: [{ role: "user", content: contexto }],
      },
    };
  }

  // openrouter, openai, gemini y "custom" (cualquier endpoint compatible
  // con la API de Chat Completions de OpenAI) comparten el mismo formato.
  const url =
    proveedor === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : proveedor === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : proveedor === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : baseUrl;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (proveedor === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL || "https://radar.app";
    headers["X-Title"] = "Radar";
  }

  return {
    url,
    headers,
    body: {
      model,
      messages: [
        { role: "system", content: PROMPT_SISTEMA },
        { role: "user", content: contexto },
      ],
      temperature: 0.3,
    },
  };
}

function extraerTexto(proveedor: Proveedor, body: unknown): string | undefined {
  const b = body as Record<string, unknown>;
  if (proveedor === "anthropic") {
    const content = b?.content as Array<{ text?: string }> | undefined;
    return content?.[0]?.text;
  }
  const choices = b?.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content;
}

export async function POST(req: NextRequest) {
  let data: ConsultaCompleta;
  let proveedor: Proveedor;
  let apiKey: string;
  let model: string;
  let baseUrl: string | undefined;

  try {
    const body = await req.json();
    data = body?.data;
    proveedor = (body?.proveedor as Proveedor) || PROVEEDOR_POR_DEFECTO;
    apiKey = typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : KEY_POR_PROVEEDOR[proveedor] || "";
    model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : MODELO_POR_DEFECTO[proveedor];
    baseUrl = typeof body?.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : BASE_URL_SERVIDOR;

    if (!data || !data.cuit) {
      return NextResponse.json({ error: "Faltan los datos de la consulta." }, { status: 400 });
    }
    if (!["openrouter", "openai", "anthropic", "gemini", "custom"].includes(proveedor)) {
      return NextResponse.json({ error: "Proveedor de IA inválido." }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "El servidor no tiene una API Key configurada para este proveedor. Cargá una para esta consulta." },
        { status: 401 }
      );
    }
    if (!model) {
      return NextResponse.json({ error: "Falta indicar el modelo." }, { status: 400 });
    }
    if (proveedor === "custom" && !baseUrl) {
      return NextResponse.json({ error: "Falta la URL del endpoint." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const contexto = armarContextoParaIA(data);
  const { url, headers, body: reqBody } = construirRequest(proveedor, model, contexto, apiKey, baseUrl);

  if (!url) {
    return NextResponse.json({ error: "No se pudo determinar el endpoint del proveedor." }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
      cache: "no-store",
    });

    const body = await res.json();

    if (!res.ok) {
      const msg =
        res.status === 401
          ? "La API Key no es válida."
          : (body as { error?: { message?: string } })?.error?.message || `Error ${res.status} al consultar la IA.`;
      return NextResponse.json({ error: msg }, { status: res.status === 401 ? 401 : 502 });
    }

    const informe = extraerTexto(proveedor, body);
    if (!informe) {
      return NextResponse.json({ error: "El proveedor no devolvió contenido." }, { status: 502 });
    }

    return NextResponse.json({ informe });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el proveedor de IA." }, { status: 502 });
  }
}
