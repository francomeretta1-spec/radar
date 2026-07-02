"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, KeyRound } from "lucide-react";
import type { ConsultaCompleta } from "@/lib/api/types";
import { Card } from "@/components/ui/card";

type Proveedor = "openrouter" | "openai" | "anthropic" | "gemini" | "custom";

// El modelo "openrouter/free" es un router que elige automáticamente entre
// los modelos gratuitos disponibles en OpenRouter (sin costo, sin
// tarjeta). Se prefiere sobre fijar un modelo puntual como
// "algo/algo:free" porque esos slugs cambian y pierden el estado gratuito
// sin aviso; el router siempre resuelve a uno vigente.
const PROVEEDORES: { id: Proveedor; label: string; modeloPorDefecto: string }[] = [
  { id: "openrouter", label: "OpenRouter (modelo gratis)", modeloPorDefecto: "openrouter/free" },
  { id: "gemini", label: "Google Gemini", modeloPorDefecto: "gemini-2.5-flash" },
  { id: "openai", label: "OpenAI", modeloPorDefecto: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", modeloPorDefecto: "claude-3-5-haiku-20241022" },
  { id: "custom", label: "Otro (compatible OpenAI)", modeloPorDefecto: "" },
];

type Estado =
  | { tipo: "listo" }
  | { tipo: "form" }
  | { tipo: "loading" }
  | { tipo: "error"; mensaje: string; requiereKey: boolean }
  | { tipo: "ok"; texto: string };

// Parser mínimo del subconjunto de markdown que le pedimos al modelo:
// "## " para títulos y "- " para ítems de lista. Nada más (ver prompt en
// app/api/informe-ia/route.ts) — evita traer una librería de markdown
// completa para un formato tan acotado y controlado.
function renderInforme(texto: string) {
  const bloques: React.ReactNode[] = [];
  let listaActual: string[] = [];

  const cerrarLista = (key: string) => {
    if (listaActual.length === 0) return;
    bloques.push(
      <ul key={key} className="list-disc pl-5 space-y-1 mb-3">
        {listaActual.map((item, i) => (
          <li key={i} className="text-sm text-(--fg) leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
    listaActual = [];
  };

  texto.split("\n").forEach((linea, i) => {
    const t = linea.trim();
    if (!t) return;

    if (t.startsWith("## ")) {
      cerrarLista(`ul-${i}`);
      bloques.push(
        <h4 key={`h-${i}`} className="font-display text-sm font-semibold text-(--radar) mt-4 mb-1.5 first:mt-0">
          {t.slice(3)}
        </h4>
      );
    } else if (t.startsWith("- ")) {
      listaActual.push(t.slice(2));
    } else {
      cerrarLista(`ul-${i}`);
      bloques.push(
        <p key={`p-${i}`} className="text-sm text-(--fg) leading-relaxed mb-2">
          {t}
        </p>
      );
    }
  });
  cerrarLista("ul-final");

  return bloques;
}

export function InformeIA({ data }: { data: ConsultaCompleta }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const [proveedor, setProveedor] = useState<Proveedor>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(PROVEEDORES[0].modeloPorDefecto);
  const [baseUrl, setBaseUrl] = useState("");

  function cambiarProveedor(p: Proveedor) {
    setProveedor(p);
    setModel(PROVEEDORES.find((x) => x.id === p)?.modeloPorDefecto ?? "");
  }

  // Primer intento: no manda ninguna key propia — el servidor usa la que
  // esté configurada como variable de entorno (OPENROUTER_API_KEY, etc.).
  // Si el servidor no tiene ninguna configurada, cae al formulario para
  // que el usuario cargue la suya solo para esa consulta (no se guarda).
  async function generarAutomatico() {
    setEstado({ tipo: "loading" });
    try {
      const res = await fetch("/api/informe-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEstado({ tipo: "error", mensaje: body.error || "No se pudo generar el informe.", requiereKey: res.status === 401 });
        return;
      }
      setEstado({ tipo: "ok", texto: body.informe });
    } catch {
      setEstado({ tipo: "error", mensaje: "No se pudo conectar con el proveedor de IA.", requiereKey: false });
    }
  }

  // La API Key nunca se guarda: vive solo en este estado de React mientras
  // se genera el informe, y se descarta apenas termina la request (éxito
  // o error) — hay que volver a cargarla la próxima vez.
  async function generarConKeyPropia() {
    if (!apiKey.trim() || !model.trim() || (proveedor === "custom" && !baseUrl.trim())) return;

    setEstado({ tipo: "loading" });
    const apiKeyUsada = apiKey;
    setApiKey("");

    try {
      const res = await fetch("/api/informe-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          proveedor,
          apiKey: apiKeyUsada,
          model,
          baseUrl: proveedor === "custom" ? baseUrl : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEstado({ tipo: "error", mensaje: body.error || "No se pudo generar el informe.", requiereKey: res.status === 401 });
        return;
      }
      setEstado({ tipo: "ok", texto: body.informe });
    } catch {
      setEstado({ tipo: "error", mensaje: "No se pudo conectar con el proveedor de IA.", requiereKey: false });
    }
  }

  const formulario = (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <div>
        <label className="text-xs text-(--fg-muted) block mb-1">Proveedor</label>
        <select
          value={proveedor}
          onChange={(e) => cambiarProveedor(e.target.value as Proveedor)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-(--border) bg-(--surface) focus:outline-none focus:border-(--radar)"
        >
          {PROVEEDORES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {proveedor === "openrouter" && (
        <p className="text-[11px] text-(--fg-faint) -mt-1">
          "openrouter/free" no tiene costo, pero igual necesitás una API Key de OpenRouter (es
          gratis crearla, sin tarjeta, en{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-(--radar)"
          >
            openrouter.ai/keys
          </a>
          ).
        </p>
      )}

      {proveedor === "gemini" && (
        <p className="text-[11px] text-(--fg-faint) -mt-1">
          Gemini tiene una capa gratuita generosa en Google AI Studio (sin tarjeta). Conseguí tu
          API Key en{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-(--radar)"
          >
            aistudio.google.com/apikey
          </a>
          .
        </p>
      )}

      {proveedor === "custom" && (
        <div>
          <label className="text-xs text-(--fg-muted) block mb-1">URL del endpoint</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://.../v1/chat/completions"
            className="w-full text-sm px-3 py-2 rounded-lg border border-(--border) bg-(--surface) focus:outline-none focus:border-(--radar)"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-(--fg-muted) block mb-1">Modelo</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="ej. gpt-4o-mini"
          className="w-full text-sm px-3 py-2 rounded-lg border border-(--border) bg-(--surface) focus:outline-none focus:border-(--radar)"
        />
      </div>

      <div>
        <label className="text-xs text-(--fg-muted) flex items-center gap-1.5 mb-1">
          <KeyRound size={13} />
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generarConKeyPropia()}
          placeholder="sk-…"
          autoComplete="off"
          className="w-full text-sm px-3 py-2 rounded-lg border border-(--border) bg-(--surface) focus:outline-none focus:border-(--radar)"
        />
        <p className="text-[11px] text-(--fg-faint) mt-1.5">
          No se guarda en ningún lado: se usa solo para esta consulta y se descarta al instante.
        </p>
      </div>

      <button
        onClick={generarConKeyPropia}
        disabled={!apiKey.trim() || !model.trim() || (proveedor === "custom" && !baseUrl.trim())}
        className="flex items-center justify-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-(--radar) text-white hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        <Sparkles size={15} />
        Generar informe con IA
      </button>
    </div>
  );

  return (
    <Card eyebrow="Radar · IA" title="Informe para toma de decisión">
      {estado.tipo === "listo" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-(--fg-muted)">
            Generá un resumen en lenguaje claro de toda la información relevada (BCRA, ARCA, cheques
            rechazados) para ayudarte a decidir. Es un apoyo informativo, no reemplaza tu propio análisis.
          </p>
          <button
            onClick={generarAutomatico}
            className="flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-(--radar) text-white hover:opacity-90 transition-opacity"
          >
            <Sparkles size={15} />
            Generar informe con IA
          </button>
          <button
            onClick={() => setEstado({ tipo: "form" })}
            className="text-xs text-(--fg-muted) hover:text-(--radar) transition-colors"
          >
            Usar otro proveedor o mi propia API Key
          </button>
        </div>
      )}

      {estado.tipo === "form" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-(--fg-muted)">
            Generá un resumen en lenguaje claro de toda la información relevada (BCRA, ARCA, cheques
            rechazados) para ayudarte a decidir. Es un apoyo informativo, no reemplaza tu propio análisis.
          </p>
          {formulario}
        </div>
      )}

      {estado.tipo === "loading" && (
        <div className="flex items-center gap-2 text-sm text-(--fg-muted) py-2">
          <Loader2 size={15} className="animate-spin" />
          Analizando la situación del CUIT…
        </div>
      )}

      {estado.tipo === "error" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-(--danger)">{estado.mensaje}</p>
          {estado.requiereKey ? (
            formulario
          ) : (
            <button
              onClick={generarAutomatico}
              className="flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg border border-(--border) hover:bg-(--surface-raised) transition-colors"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          )}
        </div>
      )}

      {estado.tipo === "ok" && (
        <div>
          <div>{renderInforme(estado.texto)}</div>
          <button
            onClick={() => setEstado({ tipo: "listo" })}
            className="flex items-center gap-1.5 text-xs text-(--fg-muted) hover:text-(--radar) transition-colors mt-2"
          >
            <RefreshCw size={12} />
            Generar otro informe
          </button>
          <p className="text-[11px] text-(--fg-faint) mt-3">
            Generado automáticamente por IA a partir de los datos de este informe. Puede contener errores;
            la decisión final es tuya.
          </p>
        </div>
      )}
    </Card>
  );
}
