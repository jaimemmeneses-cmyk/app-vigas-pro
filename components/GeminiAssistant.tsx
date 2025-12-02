import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { AppState, ChatMessage } from '../types';
import { GeminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface GeminiAssistantProps {
  beamState: AppState;
  onUpdateBeam: (newConfig: Partial<AppState>) => void;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ beamState, onUpdateBeam }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "¡Hola! Soy tu asistente de ingeniería Gemini. Puedo explicar el análisis actual o ayudarte a configurar la viga (ej. 'Haz una viga de 5m empotrada con una carga central')." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use ref for service to avoid re-instantiation
  const geminiService = useRef(new GeminiService());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
        const response = await geminiService.current.analyzeOrUpdateBeam(userMsg, beamState);
        
        if (response.newConfig) {
            onUpdateBeam(response.newConfig);
        }

        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
        setMessages(prev => [...prev, { role: 'model', text: 'Lo siento, ocurrió un error.', isError: true }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-full md:w-80 lg:w-96 fixed right-0 top-0 bottom-0 shadow-xl z-20">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-2">
        <Sparkles className="w-5 h-5" />
        <h2 className="font-semibold">Asistente Gemini</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              } ${msg.isError ? 'bg-red-50 border border-red-200 text-red-800' : ''}`}
            >
               {msg.role === 'model' && !msg.isError ? (
                   <ReactMarkdown>{msg.text}</ReactMarkdown>
               ) : (
                   msg.text
               )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pensando...
                </div>
            </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Pregunta a Gemini..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};