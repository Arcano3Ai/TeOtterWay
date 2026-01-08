
import { GoogleGenAI, Modality, GenerateContentParameters } from "@google/genai";

export class GeminiService {
  private static audioCtx: AudioContext | null = null;
  
  // Memoria de sesión para evitar modelos agotados
  private static preferredTextModel: string | null = null;
  private static preferredImageModel: string | null = null;

  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Intenta ejecutar una tarea de generación de contenido con fallback automático
   */
  private static async safeGenerateContent(
    params: Omit<GenerateContentParameters, 'model'>,
    modelHierarchy: string[],
    isImage: boolean = false
  ) {
    const ai = this.getAI();
    let lastError: any;

    // Empezar desde el modelo preferido si ya se detectó agotamiento previo
    const startIndex = modelHierarchy.indexOf(
      (isImage ? this.preferredImageModel : this.preferredTextModel) || modelHierarchy[0]
    );

    for (let i = Math.max(0, startIndex); i < modelHierarchy.length; i++) {
      const modelName = modelHierarchy[i];
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelName,
        });
        
        // Si tiene éxito, guardamos este modelo como el preferido para esta sesión
        if (isImage) this.preferredImageModel = modelName;
        else this.preferredTextModel = modelName;
        
        return response;
      } catch (e: any) {
        lastError = e;
        const errorMsg = e.message?.toLowerCase() || "";
        
        // Si el error es por falta de tokens o cuota (429 / Resource Exhausted)
        if (errorMsg.includes("429") || errorMsg.includes("exhausted") || errorMsg.includes("quota")) {
          console.warn(`[GeminiService] Modelo ${modelName} agotado. Bajando de nivel...`);
          continue; 
        }
        
        // Si es otro tipo de error (como API Key inválida), lo lanzamos inmediatamente
        throw e;
      }
    }
    throw lastError;
  }

  static async generateCinematicTrailer(score: number): Promise<string | null> {
    try {
      const ai = this.getAI();
      const intensity = score > 5000 ? "extreme action" : "calm and mystical";
      
      // Veo ya es un modelo de preview, usamos el fast para mayor disponibilidad
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A cinematic 3D voxel art trailer for a game. A cyber-otter with glowing blue eyes swimming through a neon digital ocean with voxel islands. The scene is ${intensity}, high-speed movements, glowing trails, 4k resolution, cinematic lighting, epic composition.`,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) return null;

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e: any) {
      console.error("Video Gen Error:", e);
      throw e;
    }
  }

  static async generateCoverImage(): Promise<string | null> {
    const hierarchy = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
    
    try {
      const response = await this.safeGenerateContent({
        contents: {
          parts: [{ text: "High-quality cinematic background for 'The Otter Way'. Heroic voxel art style otter in a futuristic digital ocean. Cyberpunk aesthetics, neon blue water, cinematic lighting. Composition should have clear space in the center-top for large titles. 3D render style." }]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      }, hierarchy, true);

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e: any) {
      console.error("Image Gen Error:", e);
      throw e;
    }
  }

  static async getCommentary(state: any) {
    const hierarchy = ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'];
    
    try {
      const response = await this.safeGenerateContent({
        contents: `Eres el Espíritu del Río. 
        Comenta brevemente sobre esta situación táctica de la nutria:
        Estado: ${state.state}, Puntos: ${state.score}, Velocidad: ${state.speed} km/h.
        Sé místico y usa términos tecnológicos. Máximo 12 palabras.`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      }, hierarchy);

      return response.text || "La simulación fluye.";
    } catch (e: any) {
      console.error("Gemini Error:", e);
      throw e;
    }
  }

  static async speak(text: string) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Dilo con tono místico y amigable: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await this.decodeAudioData(this.decodeBase64(base64Audio), this.audioCtx);
        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioCtx.destination);
        source.start();
      }
    } catch (e: any) {
      console.error("TTS Error:", e);
    }
  }

  private static decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private static async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }
}
