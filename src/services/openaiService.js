// Serviço para integração com a API da OpenAI
const API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

/**
 * Analisa uma transcrição de reunião de vendas usando a API da OpenAI
 * @param {string} transcricao - Texto da transcrição da reunião
 * @returns {Promise<Object>} - Objeto com os resultados da análise
 */
export const analisarTranscricao = async (transcricao) => {
  try {
    // Em um ambiente real, isso seria uma chamada à API da OpenAI
    // Para o MVP, vamos simular a resposta para demonstração
    
    // Simulação de processamento (em produção, seria substituído pela chamada real à API)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Análise simulada baseada no conteúdo da transcrição
    const tamanhoTranscricao = transcricao.length;
    
    // Chance de fechamento baseada no tamanho da transcrição (apenas para demonstração)
    let chanceFechamento = Math.min(Math.floor(tamanhoTranscricao / 100), 95);
    chanceFechamento = Math.max(chanceFechamento, 30);
    
    // Verificações simples no texto para personalizar a resposta
    const contemPreco = transcricao.toLowerCase().includes('preço') || 
                        transcricao.toLowerCase().includes('valor') ||
                        transcricao.toLowerCase().includes('custo');
    
    const contemObjecao = transcricao.toLowerCase().includes('caro') || 
                          transcricao.toLowerCase().includes('pensar') ||
                          transcricao.toLowerCase().includes('concorrente');
    
    const contemInteresse = transcricao.toLowerCase().includes('interessante') || 
                            transcricao.toLowerCase().includes('gostei') ||
                            transcricao.toLowerCase().includes('quando podemos');
    
    // Ajuste da chance baseado em palavras-chave
    if (contemObjecao) chanceFechamento -= 15;
    if (contemInteresse) chanceFechamento += 20;
    if (contemPreco && !contemObjecao) chanceFechamento += 10;
    
    // Garantir que a chance esteja entre 0 e 100
    chanceFechamento = Math.min(Math.max(chanceFechamento, 0), 100);
    
    // Gerar estratégia baseada na análise
    let estrategia = '';
    if (contemObjecao) {
      estrategia = `O cliente demonstrou preocupação com ${contemPreco ? 'o preço' : 'alguns aspectos'}. Recomendo:\n\n` +
                   `1. Reforçar o valor entregue, destacando o ROI\n` +
                   `2. Oferecer um case de sucesso similar\n` +
                   `3. Propor um período de teste ou implementação gradual\n\n` +
                   `No follow-up, envie materiais específicos que abordem as objeções levantadas.`;
    } else if (contemInteresse) {
      estrategia = `O cliente demonstrou interesse claro. Recomendo:\n\n` +
                   `1. Avançar para uma proposta comercial detalhada\n` +
                   `2. Sugerir uma próxima reunião com stakeholders adicionais\n` +
                   `3. Apresentar um cronograma de implementação\n\n` +
                   `Importante: não deixe passar mais de 48h para o próximo contato.`;
    } else {
      estrategia = `O cliente está em fase de avaliação. Recomendo:\n\n` +
                   `1. Enviar materiais complementares sobre os pontos discutidos\n` +
                   `2. Agendar uma demonstração técnica mais aprofundada\n` +
                   `3. Mapear outros decisores no processo\n\n` +
                   `Mantenha contato semanal para não perder momentum.`;
    }
    
    // Gerar feedback baseado na análise
    let feedback = '';
    if (tamanhoTranscricao < 500) {
      feedback = `A reunião foi muito curta, o que sugere que você pode não ter explorado adequadamente as necessidades do cliente. Procure fazer mais perguntas abertas e aprofundar a descoberta de necessidades.`;
    } else if (contemPreco && tamanhoTranscricao < 1000) {
      feedback = `Você entrou na discussão de preço muito cedo, antes de estabelecer completamente o valor da solução. Da próxima vez, construa mais valor antes de abordar aspectos comerciais.`;
    } else if (!transcricao.toLowerCase().includes('pergunta')) {
      feedback = `Não identifiquei muitas perguntas na sua abordagem. Lembre-se que uma boa reunião de vendas deve ter 70% de escuta e 30% de fala do vendedor. Faça mais perguntas para entender o contexto e as necessidades específicas.`;
    } else {
      feedback = `Sua condução da reunião foi equilibrada. Pontos positivos:\n\n` +
                 `- Boa exploração das necessidades do cliente\n` +
                 `- Apresentação clara da solução\n` +
                 `- Encaminhamento adequado dos próximos passos\n\n` +
                 `Para melhorar ainda mais, considere preparar histórias de sucesso mais específicas para o segmento do cliente.`;
    }
    
    return {
      chanceFechamento,
      estrategia,
      feedback
    };
  } catch (error) {
    console.error('Erro ao analisar transcrição:', error);
    throw new Error('Não foi possível analisar a transcrição. Por favor, tente novamente.');
  }
};

/**
 * Em um ambiente de produção, esta função seria implementada para
 * fazer a chamada real à API da OpenAI
 */
const callOpenAI = async (prompt) => {
  // Implementação real da chamada à API da OpenAI
  // Exemplo:
  /*
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Você é um assistente comercial especializado em análise de reuniões de vendas.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
  */
  
  // Para o MVP, retornamos uma resposta simulada
  return "Resposta simulada da API";
};

export default {
  analisarTranscricao
};
