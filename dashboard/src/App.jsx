import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Database, GitMerge } from 'lucide-react';
import NetworkGraph from './components/NetworkGraph';
import './index.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    // Simular carga de datos estáticos desde JSON
    fetch('/data/alertas.json')
      .then(res => res.json())
      .then(data => {
        setAlertas(data);
        setTimeout(() => setLoading(false), 800); // Para efecto de UI
      })
      .catch(err => {
        console.error("Error cargando alertas:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-container">
      {/* Capa de Carga */}
      <div className={`loading-overlay ${!loading ? 'fade-out' : ''}`}>
        <Activity size={48} className="animate-pulse" />
        <div>Sincronizando Nodos de Poder...</div>
      </div>

      {/* Navegación Superior Overlay */}
      <div className="top-nav">
        <div className="glass-panel" style={{ padding: '8px 20px' }}>
          <h1 className="brand-title">
            <ShieldAlert size={28} />
            <span>ECUA</span>WATCH
          </h1>
        </div>
        <button className="icon-btn" title="Estado de la Base de Datos"><Database size={20} /></button>
        <button className="icon-btn" title="Ver Vínculos"><GitMerge size={20} /></button>
      </div>

      {/* Contenedor del Grafo WebGL */}
      <div className="graph-container">
        <NetworkGraph onNodeSelect={setSelectedNode} />
      </div>

      {/* Detalle del Nodo (Radiografía) */}
      <div className={`glass-panel floating-panel node-detail ${selectedNode ? 'active' : ''}`}>
        <div className="panel-header">
          Radiografía 360°
        </div>
        {selectedNode && (
          <div>
            <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>{selectedNode.label}</h3>
            <div className="data-row">
              <span className="data-label">Identificador (RUC)</span>
              <span className="data-value">{selectedNode.id}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Tipo</span>
              <span className="data-value" style={{textTransform: 'capitalize'}}>{selectedNode.tipo}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Score Causal</span>
              <span className="data-value">{selectedNode.score}</span>
            </div>
          </div>
        )}
      </div>

      {/* Panel Lateral de Alertas */}
      <div className="glass-panel sidebar">
        <div className="floating-panel" style={{ height: '100%', padding: '20px 10px 20px 20px' }}>
          <div className="panel-header">
            <Activity size={20} color="var(--accent-cyan)" />
            Alertas de Inteligencia
          </div>
          
          <div className="alert-list">
            {alertas.length === 0 && !loading && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No hay alertas activas u originadas en el sistema.
              </div>
            )}
            {alertas.map((alerta, i) => (
              <div key={i} className={`alert-item ${alerta.severidad || 'media'}`}>
                <div className="alert-title">
                  {alerta.tipo_alerta.replace(/_/g, ' ')}
                  <span className={`badge ${alerta.severidad}`}>{alerta.severidad}</span>
                </div>
                <div className="alert-body">
                  {alerta.descripcion}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
