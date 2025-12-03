import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

interface LoginGateProps {
  children: React.ReactNode;
}

// 🔐 LA CONTRASEÑA MAESTRA (Cámbiala aquí si quieres)
const PASSWORD_SECRET = "INGENIERO2025";

export const LoginGate: React.FC<LoginGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si ya ingresó antes (para no pedir clave a cada rato)
    const storedAuth = localStorage.getItem('beam_app_pro_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD_SECRET) {
      setIsAuthenticated(true);
      localStorage.setItem('beam_app_pro_auth', 'true'); // Guardar sesión
      setError(false);
    } else {
      setError(true);
      setInput('');
    }
  };

  if (loading) return null; // Evita parpadeos mientras carga

  // Si ya pasó la seguridad, mostramos la App (los hijos)
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Si no, mostramos la pantalla de bloqueo
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-700">
        
        {/* Cabecera Azul */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 text-center relative overflow-hidden">
          {/* Círculos decorativos de fondo */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
          
          <div className="bg-white/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-inner">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1 tracking-tight">Calculadora de Vigas PRO</h1>
          <p className="text-blue-100 text-sm font-medium">Área Exclusiva para Miembros</p>
        </div>

        {/* Formulario */}
        <div className="p-8 bg-white">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Contraseña de Acceso
              </label>
              <input
                type="password"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(false);
                }}
                className={`w-full px-4 py-3.5 border rounded-xl focus:ring-4 focus:outline-none transition-all text-lg tracking-widest text-center font-mono placeholder-slate-300
                  ${error 
                    ? 'border-red-300 focus:ring-red-100 bg-red-50 text-red-900' 
                    : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500 text-slate-800'
                  }`}
                placeholder="••••••••••••"
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm mt-3 text-center font-medium animate-pulse bg-red-50 py-1 rounded-md border border-red-100">
                  🚫 Contraseña incorrecta
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Desbloquear Herramienta <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> 
              Acceso Seguro & Encriptado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};