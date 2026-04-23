import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';

// Un componente para montar el WebGL canvas de Sigma
const NetworkGraph = ({ onNodeSelect }) => {
  const containerRef = useRef(null);
  const [sigmaInst, setSigmaInst] = useState(null);

  useEffect(() => {
    // 1. Instanciar Graphology
    const graph = new Graph();
    
    // 2. Fetch de datos masivos prerenderizados (generados por exportador_api.py)
    fetch('/data/grafo_sigma.json')
      .then(res => res.json())
      .then(data => {
        // Cargar nodos y ejes
        data.nodes.forEach(node => {
          // Asignar posiciones aleatorias iniciales para que ForceAtlas2 las acomode
          if (node.attributes.x === 0 && node.attributes.y === 0) {
            node.attributes.x = Math.random() * 100;
            node.attributes.y = Math.random() * 100;
          }
          graph.addNode(node.key, node.attributes);
        });
        
        data.edges.forEach(edge => {
          try {
            graph.addEdge(edge.source, edge.target, edge.attributes);
          } catch(e) { /* Ignorar ejes huérfanos */ }
        });

        // 3. Renderizado con Sigma.js usando WebGL
        if (containerRef.current) {
          const renderer = new Sigma(graph, containerRef.current, {
            renderLabels: true,
            defaultNodeColor: "#999",
            defaultEdgeColor: "#333",
            labelFont: "JetBrains Mono",
            labelColor: { color: "#F1F5F9" },
            labelSize: 10,
          });

          // 4. Iniciar layout ForceAtlas2 en WebWorker paralelo (no congela UI)
          // Se detiene luego de unos segundos cuando se estabiliza.
          const sensibleSettings = forceAtlas2.inferSettings(graph);
          forceAtlas2.assign(graph, { iterations: 100, settings: sensibleSettings });
          
          setSigmaInst(renderer);

          // 5. Interacción: Click para ver radiografía
          renderer.on("clickNode", ({ node }) => {
            const attr = graph.getNodeAttributes(node);
            if (onNodeSelect) {
              onNodeSelect({
                id: node,
                label: attr.label,
                tipo: attr.tipo,
                score: attr.score
              });
            }
          });
          
          // Efecto hover (Highlight connections) - Simplificado
          let hoveredNode = null;
          renderer.on("enterNode", ({ node }) => {
            hoveredNode = node;
            renderer.refresh(); // Gatilla un re-render interno rápido (WebGL level)
          });
          renderer.on("leaveNode", () => {
            hoveredNode = null;
            renderer.refresh();
          });
          
          renderer.setSetting("nodeReducer", (node, data) => {
            const res = { ...data };
            if (hoveredNode && !graph.hasEdge(node, hoveredNode) && !graph.hasEdge(hoveredNode, node) && node !== hoveredNode) {
              res.color = "#1a202c"; // Atenuar los no conectados
            }
            return res;
          });
          
          renderer.setSetting("edgeReducer", (edge, data) => {
            const res = { ...data };
            if (hoveredNode && !graph.hasExtremity(edge, hoveredNode)) {
              res.hidden = true; // Ocultar ejes no relacionados
            }
            return res;
          });
        }
      })
      .catch(err => {
        console.error("Error cargando grafo masivo:", err);
        // Fallback: Crear grafo de demo si no hay datos
        if (containerRef.current && !sigmaInst) {
          graph.addNode("A", { x: 0, y: 0, size: 20, color: "#EF4444", label: "Contraloría (Demo)" });
          graph.addNode("B", { x: 10, y: 10, size: 10, color: "#3B82F6", label: "Proveedor Z (Demo)" });
          graph.addEdge("A", "B", { color: "#FFF" });
          const renderer = new Sigma(graph, containerRef.current);
          setSigmaInst(renderer);
        }
      });

    return () => {
      // Limpieza
      if (sigmaInst) sigmaInst.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="sigma-container" style={{ background: 'transparent' }} />
  );
};

export default NetworkGraph;
