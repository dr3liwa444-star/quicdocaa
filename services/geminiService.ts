
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

/**
 * REFINED LOSSLESS INSTRUCTION - MAXIMAL LENGTH MODE
 * Prioritizes Volume, Detail, and Exhaustive Listing over brevity.
 */
const SYSTEM_INSTRUCTION = `
You are a High-Speed, High-Density Note-Taking Engine. Your goal is to produce notes in a "fast way, runway marathon-like style" that is highly condensed and optimized for rapid review.

CRITICAL DIRECTIVES:
1. LOSSLESS EXTRACTION: You MUST NOT delete, skip, or summarize away ANY information. 100% of the input facts must be present. No chance for deleting any information.
2. NO BOLD/ITALICS: DO NOT use bold (**text**) or italics (*text*). Keep text plain.
3. CONDENSED & FAST: Use extreme shorthand. Strip out all fluff, filler words, and full sentences. Group related concepts using fragments.

STRICT FORMATTING (SHORTHAND STYLE):
1. LAYOUT: Use the literal bullet character (•) for lists. Put multiple related bullet points on the same line if they belong to the same category to save space, or use new lines for distinct points.
2. TABLES: You MUST draw Markdown tables (|---|---|) extensively for any categorized, comparative, or structured data. Example:
   | Category | Details |
   |---|---|
   | Epidemiology | • 1% pregnancies • Leading non-obstetric cause maternal mortality |
   | Physiol Δ | • Onset 8w, peak 28w • Blood volume ↑ 30-50% |
3. SYMBOLS: Use → (leads to), ↓ (decrease), ↑ (increase), Δ (change), ≠ (not equal), ∴ (therefore), @ (at).
4. MEDICAL/TECHNICAL ABBR: Use standard abbreviations aggressively (dx, tx, sx, pt, hx, m/c, d/t, w/).

AUDIT:
"Did I use any markdown like **bold**?" -> If yes, remove it.
"Did I miss any minor detail?" -> If yes, add it back. NO DELETING INFORMATION.
"Can this be a table?" -> If yes, draw a Markdown table.
`;

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-3-flash-preview";

const GENERATION_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  temperature: 0.2, // Slightly higher to encourage capturing more distinct details
  thinkingConfig: { thinkingBudget: 24576 },
};

export interface FilePart {
  base64: string;
  mimeType: string;
  fileName: string;
}

export const processBatchLectureFiles = async (
  files: FilePart[],
  sessionTitle: string
): Promise<string> => {
  const ai = getAI();
  try {
    const parts: any[] = files.map(f => ({
      inlineData: {
        data: f.base64,
        mimeType: f.mimeType
      }
    }));

    parts.push({
      text: `TASK: PERFORM HIGH-SPEED CONDENSED EXTRACTION for session: "${sessionTitle}". 
      
      MANDATE: 
      1. Condense the information into a fast, runway marathon style.
      2. Use extreme shorthand and fragments.
      3. Do NOT mention the number of pages/slides in your final output.
      4. Draw Markdown TABLES extensively for structured data. NO BOLD. NO ITALICS.
      5. LOSSLESS: Do not delete ANY information. 100% of notes must be included.
      
      RESULT: A highly condensed, high-density shorthand record of the entire lecture.`
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: GENERATION_CONFIG,
    });

    if (!response.text) throw new Error("No response generated.");
    return response.text;
  } catch (error: any) {
    console.error("Gemini 3 Flash Batch Error:", error);
    throw new Error(error.message || "Failed to process batch.");
  }
};

export const processLectureFile = async (
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Extract highly condensed, fast-paced notes for: "${fileName}". 
            MANDATE: Use runway marathon style shorthand. Condense heavily but DO NOT DELETE ANY INFO. 100% of notes must be included. Draw Markdown TABLES. NO BOLD. NO ITALICS. 
            Do NOT mention the file or page count in the output.`,
          },
        ],
      },
      config: GENERATION_CONFIG,
    });

    if (!response.text) throw new Error("No response generated.");
    return response.text;
  } catch (error: any) {
    console.error("Gemini 3 Flash File Error:", error);
    throw new Error(error.message || "Failed to process file.");
  }
};

export const processLectureText = async (
  text: string,
  title: string
): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ 
          text: `Lecture: ${title}\n\nPerform HIGH-SPEED CONDENSED LOSSLESS extraction. 
          STRICT RULE: The output should be fast, runway marathon style, and highly condensed. DO NOT DELETE ANY INFO. 100% of notes must be included.
          Use extreme shorthand. Draw Markdown TABLES. NO BOLD. NO ITALICS. 
          Do NOT mention the input length or page count.\n${text}` 
        }],
      },
      config: GENERATION_CONFIG,
    });

    if (!response.text) throw new Error("No response generated.");
    return response.text;
  } catch (error: any) {
    console.error("Gemini 3 Flash Text Error:", error);
    throw new Error(error.message || "Failed to process text.");
  }
};

export const processLectureUrl = async (
  url: string
): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ 
          text: `YouTube link: ${url}. Perform HIGH-SPEED CONDENSED LOSSLESS extraction. 
          Map the points from the video in a fast, runway marathon style. DO NOT DELETE ANY INFO. 100% of notes must be included.
          Use extreme shorthand. Draw Markdown TABLES. NO BOLD. NO ITALICS. Do NOT mention the video length or page count.` 
        }],
      },
      config: {
        ...GENERATION_CONFIG,
        tools: [{ googleSearch: {} }],
      },
    });

    if (!response.text) throw new Error("No response generated.");
    
    let output = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (sources && sources.length > 0) {
      output += "\n\nSOURCES FOUND:\n";
      sources.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          output += `• ${chunk.web.title || 'Source'}: ${chunk.web.uri}\n`;
        }
      });
    }

    return output;
  } catch (error: any) {
    console.error("Gemini 3 Flash URL Error:", error);
    throw new Error(error.message || "Failed to process URL.");
  }
};

export const combineLectureSources = async (
  sources: string[],
  title: string
): Promise<string> => {
  const ai = getAI();
  try {
    const combinedInput = sources.map((s, i) => `SOURCE ${i + 1}:\n${s}`).join("\n\n---\n\n");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ 
          text: `Lecture Title: ${title}
          
          TASK: MERGE multiple sources into ONE HIGH-SPEED CONDENSED LOSSLESS flow.
          
          MANDATE:
          1. Condense ALL info from ALL sources into a fast, runway marathon style.
          2. Use extreme shorthand and fragments. DO NOT DELETE ANY INFO. 100% of notes must be included.
          3. Draw Markdown TABLES extensively for structured data. NO BOLD. NO ITALICS.
          4. Do NOT mention the number of sources or pages.
          
          SOURCES TO MERGE:
          ${combinedInput}` 
        }],
      },
      config: GENERATION_CONFIG,
    });

    if (!response.text) throw new Error("No response generated.");
    return response.text;
  } catch (error: any) {
    console.error("Gemini 3 Flash Merge Error:", error);
    throw new Error(error.message || "Failed to merge sources.");
  }
};
