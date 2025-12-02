import {
  GoogleGenAI,
  FunctionDeclaration,
  Type,
  GenerateContentResponse,
} from '@google/genai';
import { AppState, BeamConfig, Support, Load } from '../types';

// Define the tool for updating beam configuration
const updateBeamTool: FunctionDeclaration = {
  name: 'updateBeamConfiguration',
  description: 'Update the beam configuration including length, supports, and loads based on user request.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      length: {
        type: Type.NUMBER,
        description: 'Total length of the beam in meters.',
      },
      supports: {
        type: Type.ARRAY,
        description: 'List of supports.',
        items: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: 'Position in meters.' },
            type: { type: Type.STRING, enum: ['pinned', 'roller', 'fixed'], description: 'Type of support.' },
          },
          required: ['x', 'type'],
        },
      },
      loads: {
        type: Type.ARRAY,
        description: 'List of loads.',
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['point', 'udl', 'moment'] },
            magnitude: { type: Type.NUMBER, description: 'Force in kN (negative for down) or Moment in kNm.' },
            w: { type: Type.NUMBER, description: 'Distributed load intensity in kN/m (negative for down).' },
            x: { type: Type.NUMBER, description: 'Position for point load/moment.' },
            x_start: { type: Type.NUMBER, description: 'Start position for UDL.' },
            x_end: { type: Type.NUMBER, description: 'End position for UDL.' },
          },
          required: ['type'],
        },
      },
    },
    required: ['length', 'supports', 'loads'],
  },
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    let apiKey = '';
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      apiKey = process.env.API_KEY;
    } else {
      console.error("API_KEY is missing from environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeOrUpdateBeam(
    userMessage: string,
    currentBeamState: AppState
  ): Promise<{ text: string; newConfig?: Partial<AppState> }> {
    try {
      // Clean state for prompt context (remove large arrays)
      const contextState = {
        length: currentBeamState.beam.length,
        supports: currentBeamState.supports,
        loads: currentBeamState.loads,
        resultsSummary: {
            maxMoment: currentBeamState.results.peaks?.maxMoment,
            reactions: currentBeamState.results.reactions.map(r => ({id: r.supportId, Ry: r.Ry, M: r.M})),
            equilibrium: currentBeamState.results.checks
        }
      };

      const systemInstruction = `Eres un Asistente Experto en Ingeniería Estructural.
      Tu objetivo es ayudar a los usuarios a analizar configuraciones de vigas o ayudarlos a diseñar vigas.
      
      Contexto actual de la viga en JSON:
      ${JSON.stringify(contextState, null, 2)}

      Si el usuario pide CAMBIAR la viga (ej. "hazla de 10m", "agrega una carga", "crea un voladizo"),
      LLAMA a la herramienta 'updateBeamConfiguration' con el estado COMPLETO nuevo.
      
      Si el usuario pide ANALIZAR o EXPLICAR, proporciona una explicación de ingeniería concisa en ESPAÑOL basada en el contexto.
      
      SÉ ÚTIL Y PROFESIONAL.
      `;

      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMessage,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [updateBeamTool] }],
          temperature: 0.2, // Low temp for more deterministic tool use
        },
      });

      const text = response.text || '';
      
      // Check for tool calls
      const toolCall = response.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
      
      if (toolCall && toolCall.functionCall) {
         const fc = toolCall.functionCall;
         if (fc.name === 'updateBeamConfiguration') {
             const args = fc.args as any;
             // Process args to match AppState structure
             const newSupports = (args.supports || []).map((s: any, i: number) => ({
                 id: `S${i+1}`,
                 x: s.x,
                 type: s.type
             }));
             const newLoads = (args.loads || []).map((l: any, i: number) => ({
                 id: `L${i+1}`,
                 ...l
             }));
             
             const newConfig: Partial<AppState> = {
                 beam: { ...currentBeamState.beam, length: args.length },
                 supports: newSupports,
                 loads: newLoads
             };

             return {
                 text: "He actualizado la configuración de la viga según lo solicitado. Por favor haz clic en 'Calcular' para ver los nuevos resultados.",
                 newConfig
             };
         }
      }

      return { text };

    } catch (error) {
      console.error('Gemini API Error:', error);
      return { text: "Lo siento, encontré un error al comunicarme con el motor de inteligencia." };
    }
  }
}