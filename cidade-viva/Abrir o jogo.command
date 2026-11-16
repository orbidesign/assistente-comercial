#!/bin/bash
# Dois cliques neste arquivo (no Mac) preparam e abrem o jogo.
cd "$(dirname "$0")" || exit 1
echo "=== Três CEOs, uma padaria ==="
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Falta instalar o Node.js (é o programa que roda o jogo)."
  echo "Vou abrir o site: baixe a versão LTS, instale e depois dê dois cliques neste arquivo de novo."
  open "https://nodejs.org/pt/download"
  read -r -p "Aperte Enter para fechar."
  exit 1
fi
if [ ! -d node_modules ]; then echo "Instalando o que o jogo precisa (só na primeira vez, leva um ou dois minutos)..."; npm install || { read -r -p "A instalação falhou. Aperte Enter para fechar."; exit 1; }; fi
echo "Preparando o jogo..."
npm run build >/dev/null 2>&1 || npm run build || { read -r -p "A preparação falhou. Aperte Enter para fechar."; exit 1; }
# Se já houver um servidor do jogo aberto, fecha o antigo.
lsof -ti tcp:8787 | xargs kill 2>/dev/null
(sleep 2; open "http://localhost:8787/ceo.html") &
echo
echo "Jogo aberto no navegador: http://localhost:8787/ceo.html"
echo "Deixe esta janela aberta enquanto joga. Para encerrar, feche esta janela."
echo
node server/index.mjs
