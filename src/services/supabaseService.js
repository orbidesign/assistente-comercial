// Serviço para integração com o Supabase
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

/**
 * Simula a autenticação de usuário
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} - Objeto com os dados do usuário
 */
export const login = async (email, password) => {
  try {
    // Em um ambiente real, isso seria uma chamada à API do Supabase
    // Para o MVP, vamos simular a resposta para demonstração
    
    // Simulação de processamento (em produção, seria substituído pela chamada real à API)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificação básica de email/senha para demonstração
    if (email && password && email.includes('@') && password.length >= 6) {
      // Usuário simulado
      return {
        id: 'user-123',
        email,
        nome: email.split('@')[0],
        plano: 'free',
        analises_restantes: 3,
        analises_total: 3
      };
    } else {
      throw new Error('Email ou senha inválidos');
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    throw new Error(error.message || 'Falha na autenticação. Por favor, tente novamente.');
  }
};

/**
 * Simula o registro de um novo usuário
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} - Objeto com os dados do usuário
 */
export const registro = async (email, password) => {
  try {
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificação básica de email/senha para demonstração
    if (email && password && email.includes('@') && password.length >= 6) {
      // Usuário simulado
      return {
        id: 'user-' + Math.floor(Math.random() * 1000),
        email,
        nome: email.split('@')[0],
        plano: 'free',
        analises_restantes: 3,
        analises_total: 3
      };
    } else {
      throw new Error('Email ou senha inválidos');
    }
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    throw new Error(error.message || 'Falha no registro. Por favor, tente novamente.');
  }
};

/**
 * Simula o salvamento de uma análise
 * @param {Object} analise - Dados da análise
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Objeto com os dados da análise salva
 */
export const salvarAnalise = async (analise, userId) => {
  try {
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulação de salvamento
    const analiseId = 'analise-' + Math.floor(Math.random() * 10000);
    
    return {
      id: analiseId,
      ...analise,
      user_id: userId,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao salvar análise:', error);
    throw new Error('Não foi possível salvar a análise. Por favor, tente novamente.');
  }
};

/**
 * Simula a obtenção do histórico de análises
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Array com as análises do usuário
 */
export const obterHistoricoAnalises = async (userId) => {
  try {
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulação de histórico
    return [
      {
        id: 'analise-1001',
        meeting_title: 'Apresentação para Empresa ABC',
        client_name: 'João Silva',
        closing_chance: 75,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'analise-1002',
        meeting_title: 'Follow-up com XYZ Corp',
        client_name: 'Maria Oliveira',
        closing_chance: 45,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'analise-1003',
        meeting_title: 'Demonstração para Startup Tech',
        client_name: 'Pedro Santos',
        closing_chance: 90,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    throw new Error('Não foi possível carregar o histórico de análises. Por favor, tente novamente.');
  }
};

/**
 * Simula a obtenção de uma análise específica
 * @param {string} analiseId - ID da análise
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Objeto com os dados da análise
 */
export const obterAnalise = async (analiseId, userId) => {
  try {
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulação de análise
    return {
      id: analiseId,
      user_id: userId,
      meeting_title: 'Apresentação para Empresa ABC',
      client_name: 'João Silva',
      transcript_text: `
Vendedor: Olá, bom dia! Tudo bem com você?
Cliente: Bom dia! Tudo bem, obrigado.
Vendedor: Que bom! Então, como conversamos por e-mail, estou entrando em contato para apresentar nossa solução de gestão de vendas. Você tem uns 30 minutos disponíveis agora?
Cliente: Sim, tenho sim. Estou curioso para conhecer melhor o produto.
Vendedor: Perfeito! Vou compartilhar minha tela para mostrar a plataforma. Como mencionei, nossa solução ajuda equipes de vendas a aumentar a produtividade em até 30%.
Cliente: Interessante. E como vocês conseguem esse resultado?
Vendedor: Através da automação de tarefas repetitivas, insights baseados em dados e um processo de vendas estruturado. Deixa eu te mostrar como funciona na prática...
Cliente: Legal. E quanto custa essa solução?
Vendedor: Temos planos a partir de R$99 por usuário/mês. Mas o valor exato depende do número de usuários e dos módulos que você precisa.
Cliente: Hmm, entendi. E vocês oferecem algum período de teste?
Vendedor: Sim, oferecemos 14 dias de teste gratuito, com acesso a todas as funcionalidades.
Cliente: Ótimo! E quanto ao suporte?
Vendedor: Temos suporte por chat, e-mail e telefone em horário comercial. Nos planos mais avançados, oferecemos um gerente de sucesso dedicado.
Cliente: Entendi. Vou precisar apresentar isso para o meu gestor. Você poderia me enviar uma proposta por e-mail?
Vendedor: Claro! Vou preparar uma proposta personalizada e enviar ainda hoje. Tem alguma dúvida específica que gostaria que eu abordasse na proposta?
Cliente: Sim, seria bom detalhar o processo de implementação e o tempo necessário para começarmos a usar.
Vendedor: Perfeito, vou incluir essas informações. Normalmente, o processo de implementação leva de 1 a 3 semanas, dependendo da complexidade.
Cliente: Ok, aguardo seu e-mail então.
Vendedor: Excelente! Enviarei até o final do dia. Muito obrigado pelo seu tempo!
      `,
      closing_chance: 75,
      strategy_text: `O cliente demonstrou interesse, mas precisa de aprovação interna. Recomendo:

1. Enviar a proposta com detalhes de implementação conforme solicitado
2. Incluir casos de sucesso de empresas similares
3. Oferecer uma apresentação para o gestor dele
4. Fazer follow-up em 2-3 dias se não houver resposta

Importante: destaque o período de teste gratuito como forma de reduzir o risco da decisão.`,
      feedback_text: `Pontos positivos:
- Boa apresentação da solução
- Resposta clara sobre preços e suporte
- Comprometimento em enviar proposta personalizada

Pontos de melhoria:
- Você poderia ter explorado mais as necessidades específicas antes de falar sobre a solução
- Quando o cliente perguntou sobre preço, você poderia ter feito mais perguntas para entender o orçamento disponível
- Considere oferecer opções de próximos passos além da proposta por e-mail`,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('Erro ao obter análise:', error);
    throw new Error('Não foi possível carregar a análise. Por favor, tente novamente.');
  }
};

/**
 * Simula a atualização do plano do usuário
 * @param {string} userId - ID do usuário
 * @param {string} plano - Novo plano (free, pro, equipes)
 * @returns {Promise<Object>} - Objeto com os dados atualizados do usuário
 */
export const atualizarPlano = async (userId, plano) => {
  try {
    // Simulação de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Definir limites baseados no plano
    let analises_total = 3; // padrão para free
    
    if (plano === 'pro') {
      analises_total = 20;
    } else if (plano === 'equipes') {
      analises_total = 100;
    }
    
    // Simulação de atualização
    return {
      id: userId,
      plano,
      analises_total,
      analises_restantes: analises_total,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    throw new Error('Não foi possível atualizar o plano. Por favor, tente novamente.');
  }
};

export default {
  login,
  registro,
  salvarAnalise,
  obterHistoricoAnalises,
  obterAnalise,
  atualizarPlano
};
