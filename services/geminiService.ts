
import { GoogleGenAI, Type } from "@google/genai";
import { Parcel, AIAnalysisResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeParcels(parcels: Parcel[]): Promise<AIAnalysisResult> {
    const prompt = `
      You are an expert logistics coordinator. Review the following bulk parcel upload data for a merchant.
      Identify potential delivery issues such as:
      1. Incomplete or suspicious addresses.
      2. Mismatched service types for weight.
      3. Missing critical recipient details.

      Parcel Data:
      ${JSON.stringify(parcels, null, 2)}

      Return a JSON response evaluating these parcels.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctedParcels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    suggestedAddress: { type: Type.STRING },
                    issue: { type: Type.STRING }
                  },
                  required: ["id", "issue"]
                }
              }
            },
            required: ["summary", "recommendations", "correctedParcels"]
          }
        }
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return {
        summary: "Could not complete AI analysis at this time.",
        recommendations: ["Manually verify all addresses", "Check weight constraints"],
        correctedParcels: []
      };
    }
  }
}
