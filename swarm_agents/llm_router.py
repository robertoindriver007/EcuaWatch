import os
import time
import logging
import json
import requests
from typing import Dict, Any, List

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s [LLM ROUTER] %(message)s')

class LLMRouter:
    """
    Enrutador Inteligente para 15+ Agentes.
    Previene el error 429 (Rate Limit), ahorra RAM y gestiona fallbacks.
    Permite acceso "Nivel Pro" combinando tiers gratuitos y de pago.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LLMRouter, cls).__new__(cls)
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        # Preferir OpenRouter por su acceso a modelos Pro baratos
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
        
        # En caso de no tener OpenRouter, usar Gemini Free Tier
        self.default_model = "google/gemini-2.5-flash" if self.openrouter_api_key else "gemini-2.5-flash"
        
        # Semaforo básico (simulado vía time.sleep por rate limits)
        self.last_call_time = 0
        self.min_interval = 2.0  # Mínimo 2 segundos entre llamadas (para tiers gratuitos)

    def _wait_for_rate_limit(self):
        """Bloquea asíncronamente para proteger el rate limit API y CPU/RAM local."""
        elapsed = time.time() - self.last_call_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_call_time = time.time()

    def query(self, system_prompt: str, user_prompt: str, priority: str = "BAJA") -> str:
        """
        Ejecuta la llamada de forma enrutada.
        """
        self._wait_for_rate_limit()
        
        # Lógica de enrutamiento basado en prioridad/complejidad
        if priority == "ALTA" and self.openrouter_api_key:
            return self._call_openrouter(system_prompt, user_prompt, model="anthropic/claude-3.5-sonnet")
        elif self.openrouter_api_key:
            return self._call_openrouter(system_prompt, user_prompt, model="google/gemini-2.5-flash") # Cheap/Free via OpenRouter
        elif self.gemini_api_key:
            return self._call_gemini_direct(system_prompt, user_prompt)
        else:
            return json.dumps({
                "error": "SIN_APIS",
                "message": "Por favor, configura OPENROUTER_API_KEY o GEMINI_API_KEY en variables de entorno."
            })

    def _call_openrouter(self, system_prompt: str, user_prompt: str, model: str) -> str:
        logging.info(f"Enviando consulta a OpenRouter (Modelo: {model})...")
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": "http://localhost:3000", # Necesario para OpenRouter
            "X-Title": "EcuaWatch Agent Swarm",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        
        try:
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data, timeout=30)
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            elif response.status_code == 429:
                logging.warning("Rate limit alcanzado en OpenRouter. Esperando 10s y reintentando...")
                time.sleep(10)
                return self._call_openrouter(system_prompt, user_prompt, model)
            else:
                logging.error(f"Error OpenRouter: {response.text}")
                return "ERROR_EN_RESPUESTA_API"
        except Exception as e:
            logging.error(f"Exception OpenRouter: {e}")
            return "ERROR_DE_RED"

    def _call_gemini_direct(self, system_prompt: str, user_prompt: str) -> str:
        logging.info("Enviando consulta a Gemini Directo...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        data = {
            "system_instruction": {
                "parts": {"text": system_prompt}
            },
            "contents": [{
                "parts": [{"text": user_prompt}]
            }]
        }
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            if response.status_code == 200:
                result = response.json()
                return result["candidates"][0]["content"]["parts"][0]["text"]
            elif response.status_code in [429, 503]:
                logging.warning(f"API sobrecargada o limitada (Código {response.status_code}). Esperando 15s...")
                time.sleep(15)
                return self._call_gemini_direct(system_prompt, user_prompt)
            else:
                logging.error(f"Error Gemini API: {response.text}")
                return "ERROR_EN_RESPUESTA_API"
        except Exception as e:
            logging.error(f"Exception Gemini: {e}")
            return "ERROR_DE_RED"

# Uso de ejemplo si se ejecuta directamente:
if __name__ == "__main__":
    router = LLMRouter()
    res = router.query("Eres un bot sarcástico.", "Dime un chiste sobre economía.")
    print("Respuesta:", res)
