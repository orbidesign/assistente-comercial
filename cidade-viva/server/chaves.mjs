// Chaves das IAs guardadas neste computador (arquivo .chaves.json, fora do git).
// A tela "IAs" do jogo grava aqui; nada disso existe quando o jogo roda na Vercel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVEDORES, decidir, trocarChave } from './provedores.mjs';
import { criarJogo, dossie } from '../src/empresas/jogo.js';

const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.chaves.json');
let guardado = {};
try { guardado = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch { /* ainda não há chaves */ }
for (const [id, v] of Object.entries(guardado)) if (PROVEDORES[id]) trocarChave(id, v.chave, v.modelo);

const pegar = async (url, cabecalhos) => {
  const r = await fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(20000) });
  const t = await r.text();
  if (!r.ok) { let motivo = t.slice(0, 160); try { const e = JSON.parse(t).error; motivo = e?.message || (typeof e === 'string' ? e : motivo); } catch { /* texto puro */ } throw new Error(`a chave não foi aceita (${r.status}): ${motivo}`); }
  return JSON.parse(t);
};

// Os modelos que a chave enxerga, direto de cada casa.
async function listarModelos(id, chave) {
  if (id === 'gemini') {
    const r = await pegar('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': chave });
    return (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  }
  if (id === 'xai') return ((await pegar('https://api.x.ai/v1/models', { authorization: `Bearer ${chave}` })).data || []).map((m) => m.id);
  return ((await pegar('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': chave, 'anthropic-version': '2023-06-01' })).data || []).map((m) => m.id);
}

// Sugestão quando o modelo padrão não existe para a chave: o mais novo da linha principal de texto.
const FORA = /image|vision|tts|audio|embed|live|imagen|veo|video|robot|learn|aqa|gemma|nano|computer|guard/i;
const PREFERE = { gemini: /^gemini-[\d.]+-pro/, xai: /^grok-[\d.]+/, anthropic: /sonnet/ };
function sugerir(id, modelos, atual) {
  if (modelos.includes(atual)) return atual;
  const versao = (m) => (m.match(/\d+(\.\d+)?/g) || []).slice(0, 2).map(Number);
  const maisNovo = (a, b) => { const x = versao(a), y = versao(b); return (y[0] || 0) - (x[0] || 0) || (y[1] || 0) - (x[1] || 0) || a.length - b.length; };
  const texto = modelos.filter((m) => !FORA.test(m));
  return [...texto.filter((m) => PREFERE[id].test(m)).sort(maisNovo), ...texto.sort(maisNovo)][0] || atual;
}

export const situacaoDasChaves = () => Object.fromEntries(Object.entries(PROVEDORES).map(([id, p]) => [id, { temChave: !!p.chave, modelo: p.modelo }]));

// Grava a chave (e o modelo), lista os modelos e faz um despacho de verdade do primeiro mês do jogo.
export async function configurar({ provedor: id, chave, modelo, testar = true }) {
  if (!PROVEDORES[id]) throw new Error('provedor desconhecido');
  const nova = String(chave || '').trim() || PROVEDORES[id].chave;
  if (!nova) throw new Error('cole a chave primeiro');
  const modelos = await listarModelos(id, nova);
  const escolhido = modelos.includes(modelo) ? modelo : sugerir(id, modelos, PROVEDORES[id].modelo);
  trocarChave(id, nova, escolhido);
  guardado[id] = { chave: nova, modelo: escolhido };
  fs.writeFileSync(ARQUIVO, JSON.stringify(guardado, null, 2), { mode: 0o600 });
  const saida = { ok: true, modelos: modelos.sort(), modelo: escolhido };
  if (testar) {
    const j = criarJogo(1), t0 = Date.now();
    try {
      const r = await decidir(id, dossie(j, j.ceos.find((c) => c.id === id) || j.ceos[0]), 'ceo');
      saida.teste = { ok: !r.invalida, tokens: r.tokens, segundos: +((Date.now() - t0) / 1000).toFixed(1), diario: r.decisao?.diario || '', erro: r.invalida ? 'a IA respondeu, mas não no formato pedido' : '' };
    } catch (e) { saida.teste = { ok: false, erro: e.message }; }
  }
  return saida;
}
