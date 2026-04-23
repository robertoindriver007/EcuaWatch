"use client";
import React, { useState } from 'react';

export default function SoftGateModal() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-white/40 backdrop-blur-md" 
        onClick={() => setIsOpen(false)}
      ></div>
      
      {/* Modal Box */}
      <div className="relative bg-white border border-gray-200 shadow-2xl rounded-2xl w-full max-w-lg p-8 transform transition-all duration-300 scale-100 opacity-100">
        
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
          title="Continuar como invitado"
        >
          ✕
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido a EcuaWatch</h2>
          <p className="text-sm text-gray-500">Únete a la mayor red de vigilancia y transparencia ciudadana de Ecuador.</p>
        </div>

        {/* Auth Buttons */}
        <div className="space-y-3">
          <button className="w-full h-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-lg transition-colors">
             Continuar con Google
          </button>
          <button className="w-full h-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-lg transition-colors">
             Continuar con Apple
          </button>
          <button className="w-full h-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-lg transition-colors">
            Continuar con Microsoft
          </button>
          
          <div className="relative flex items-center py-3">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs text-center uppercase">o usando correo</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button className="w-full h-11 flex items-center justify-center bg-gray-900 hover:bg-black text-white font-semibold rounded-lg transition-colors">
            Iniciar sesión con Email
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Al registrarte aceptas los T&C y las políticas de Privacidad del ecosistema EcuaWatch.
          </p>
          <button 
            onClick={() => setIsOpen(false)}
            className="mt-4 text-sm font-semibold text-ecua-blue hover:text-blue-800 underline decoration-transparent hover:decoration-blue-800 transition-all"
          >
            Solo quiero explorar como Invitado
          </button>
        </div>
      </div>
    </div>
  );
}
