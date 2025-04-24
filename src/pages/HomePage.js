import React from 'react';

const HomePage = () => {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="py-12 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Assistente Comercial com IA</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Transforme suas reuniões de vendas em insights estratégicos prontos para ação.
          Aumente suas taxas de conversão com análises baseadas em IA.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a 
            href="/analise" 
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition duration-300"
          >
            Analisar Reunião
          </a>
          <a 
            href="/planos" 
            className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition duration-300"
          >
            Ver Planos
          </a>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">O que você recebe</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-blue-600 text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Chance de Fechamento</h3>
              <p className="text-gray-600">
                Saiba exatamente qual a probabilidade de fechar o negócio, baseado em padrões de decisão identificados pela IA.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-green-600 text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Estratégia Prática</h3>
              <p className="text-gray-600">
                Receba um plano de ação personalizado com os próximos passos para maximizar suas chances de fechamento.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-purple-600 text-xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Feedback de Performance</h3>
              <p className="text-gray-600">
                Entenda seus pontos fortes e áreas de melhoria com uma análise detalhada da sua atuação durante a reunião.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Cole a Transcrição</h3>
              <p className="text-gray-600">
                Copie e cole a transcrição da sua reunião de vendas no sistema.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">IA Analisa o Conteúdo</h3>
              <p className="text-gray-600">
                Nossa IA processa a conversa e identifica padrões de decisão e comportamento.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Receba Insights</h3>
              <p className="text-gray-600">
                Visualize a chance de fechamento, estratégia recomendada e feedback de performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Para Quem é Ideal</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">Vendedores B2B</h3>
              <p className="text-gray-600">
                Profissionais que conduzem reuniões de vendas complexas e precisam maximizar suas taxas de conversão.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">Gestores Comerciais</h3>
              <p className="text-gray-600">
                Líderes que querem melhorar o desempenho de suas equipes com feedback baseado em dados.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">Empreendedores</h3>
              <p className="text-gray-600">
                Fundadores que precisam vender seu produto/serviço e não têm experiência comercial avançada.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">Consultores</h3>
              <p className="text-gray-600">
                Profissionais que precisam converter propostas em contratos e maximizar seu pipeline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6">Pronto para aumentar suas taxas de conversão?</h2>
          <p className="text-xl mb-8">
            Comece agora mesmo com nosso plano gratuito e veja a diferença que insights estratégicos podem fazer.
          </p>
          <a 
            href="/analise" 
            className="px-8 py-4 bg-white text-blue-600 font-bold rounded-md hover:bg-gray-100 transition duration-300"
          >
            Analisar Minha Primeira Reunião
          </a>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
