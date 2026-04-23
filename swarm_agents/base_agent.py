import os
import logging
import json
from llm_router import LLMRouter

logging.basicConfig(level=logging.INFO, format='%(asctime)s [BASE OMNISCIENT AGENT] %(message)s')

class BaseOmniscientAgent:
    """
    Clase de singularidad. Todos los agentes heredarán de esta clase.
    Llama a las APIs mediante el LLMRouter inteligente para evitar bloqueos y gastar saldo innecesario.
    """
    def __init__(self, system_prompt_role: str, agent_domain: str):
        self.role = system_prompt_role
        self.domain = agent_domain
        self.router = LLMRouter()

    def call_claude_mind(self, context_memory="", latest_events="", priority="BAJA"):
        """
        Inferencia real conectada a los cerebros LLM usando la infraestructura del router.
        Lee los eventos de la web / GitHub y decide la mejor acción.
        """
        logging.info(f"🧠 Consultando al Router Híbrido para el Agente: {self.domain}...")
        
        prompt = f"Memoria histórica y base de datos (Vector): {context_memory}\n\nEventos Actuales del País/Sistema: {latest_events}\n\nCon base en tu rol, ¿Cual es tu diagnóstico y propuesta de código/negocio?"
        
        try:
            # Retorna string con el output del LLM
            response = self.router.query(self.role, prompt, priority)
            
            # Formatear a la pseudo-salida esperada por el orquestador
            return [{"domain": self.domain, "proposal": response, "priority": priority}]
        except Exception as e:
            logging.error(f"Falla crítica en inferencia: {e}")
            return [{"domain": self.domain, "proposal": f"FALLA DE INFERENCIA: {e}", "priority": "CRITICA"}]
