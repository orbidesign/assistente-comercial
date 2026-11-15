// Entrada na Vercel: todos os pedidos a /api/... chegam aqui e seguem para o mesmo
// código que roda no servidor local.
import { tratar } from '../server/index.mjs';

export default function handler(req, res) {
  return tratar(req, res);
}
