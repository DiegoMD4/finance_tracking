import { GoogleGenAI } from "@google/genai"

const REQUEST_TIMEOUT_MS = 60_000

let client: GoogleGenAI | null = null

/* const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash"

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

export async function callGemini(content: string) {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: content,
  })

  console.log(response.text)
}
 */
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
  client ??= new GoogleGenAI({ apiKey })
  return client
}

function getModel(): string {
  const model = process.env.GEMINI_MODEL
  if (!model) throw new Error("GEMINI_MODEL is not set")
  return model
}

export interface GenerateJsonParams {
  systemInstruction: string
  prompt: string
  jsonSchema: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
}

export async function generateJson(
  params: GenerateJsonParams
): Promise<unknown> {
  const response = await getClient().models.generateContent({
    model: getModel(),
    contents: params.prompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.1,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
      responseMimeType: "application/json",
      responseJsonSchema: params.jsonSchema,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  })

  const finishReason = response.candidates?.[0]?.finishReason
  if (finishReason && finishReason !== "STOP") {
    throw new Error("Gemini stopped early: " + finishReason)
  }
  const text = response.text
  if (!text) throw new Error("Gemini returned an empty response")

  return JSON.parse(text)
}
