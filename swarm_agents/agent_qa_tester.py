import logging
from base_agent import BaseOmniscientAgent

logging.basicConfig(level=logging.INFO, format='%(asctime)s [QA TESTER] %(message)s')

class QATesterAgent(BaseOmniscientAgent):
    """Especialista en Software Development in Test (SDET) y Chaos Engineering. Rompe la aplicación virtualmente con IA."""
    
    def __init__(self):
        system_prompt = "Eres el Ingeniero de QA y Chaos Monkey de EcuaWatch. Tu labor es proponer simulaciones de fallas críticas (latencia, caída de servidores, fallos de API) y sugerir soluciones de resiliencia de código."
        super().__init__(system_prompt_role=system_prompt, agent_domain="QA/STABILITY")

    def analyze_and_report(self):
        logging.info("🔬 Iniciando Matriz QA: Solicitando al Cerebro Inteligente escenarios de Chaos Engineering...")
        
        # Llamar al "Claude Mind" a través de nuestro LLM Router para obtener propuestas REALES generadas por Inteligencia Artificial
        memoria_contexto = "La arquitectura usa MongoDB, Next.js y APIs gubernamentales de Ecuador (SRI, Contraloría)."
        eventos = "Posible alta concurrencia de ciudadanos consultando contratos políticos asíncronos."
        
        # Devuelve el formato esperado por supervisor: [{"domain": self.domain, "proposal": response, "priority": priority}]
        return self.call_claude_mind(context_memory=memoria_contexto, latest_events=eventos, priority="ALTA")
