// Recherche im Netz mit Gemini und Google-Suche, testweise als Alternative zu Claude (RESEARCH_LLM=gemini).
// Gleiche Aufgabe und gleiches Ergebnis wie in research.ts; das Modell sucht selbst, so oft es will.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Research } from "./research.ts";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Recherchiert ein Unternehmen mit Gemini. Benötigt GEMINI_API_KEY. */
export async function researchWithGemini(system: string, prompt: string): Promise<Research> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      tools: [{ googleSearch: {} }],
    },
  });

  const candidate = response.candidates?.[0];
  const text = response.text?.trim() ?? "";
  if (text === "") {
    throw new Error(`Gemini lieferte keinen Text${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}.`);
  }
  if (candidate?.finishReason === "MAX_TOKENS") throw new Error("Die Recherche wurde abgeschnitten (MAX_TOKENS).");

  // Die Adressen sind Weiterleitungen über Google; der Titel nennt meist die Domain der Quelle.
  const sources = new Map<string, Research["sources"][number]>();
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    if (chunk.web?.uri) sources.set(chunk.web.uri, { url: chunk.web.uri, title: chunk.web.title ?? chunk.web.uri, pageAge: null });
  }
  // Die Suchergebnisse, die das Modell liest, zählen als Eingabe (toolUsePromptTokenCount).
  const u = response.usageMetadata;
  const usage = {
    inputTokens: (u?.promptTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0),
    outputTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    searches: candidate?.groundingMetadata?.webSearchQueries?.length ?? 0,
  };
  return { model: response.modelVersion ?? GEMINI_MODEL, text, sources: [...sources.values()], usage };
}
