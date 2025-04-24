import React from 'react';

const PlanosPage = () => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-12">Planos e Preços</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Plano Free */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 bg-gray-50">
            <h2 className="text-2xl font-bold text-center">Free</h2>
            <p className="text-center text-gray-600 mt-2">Para começar</p>
            <p className="text-center mt-4">
              <span className="text-4xl font-bold">R$0</span>
              <span className="text-gray-600">/mês</span>
            </p>
          </div>
          
          <div className="p-6">
            <ul className="space-y-3">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>3 análises por mês</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Histórico de 30 dias</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Análise básica</span>
              </li>
              <li className="flex items-center text-gray-400">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <span>Exportação de relatórios</span>
              </li>
              <li className="flex items-center text-gray-400">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <span>Análise avançada</span>
              </li>
            </ul>
            
            <button className="w-full mt-8 py-3 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition duration-300">
              Plano Atual
            </button>
          </div>
        </div>
        
        {/* Plano Pro */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-500 transform scale-105">
          <div className="p-6 bg-blue-50">
            <div className="bg-blue-500 text-white text-xs font-bold uppercase py-1 px-2 rounded-full inline-block mb-2">
              Mais Popular
            </div>
            <h2 className="text-2xl font-bold text-center">Pro</h2>
            <p className="text-center text-gray-600 mt-2">Para profissionais</p>
            <p className="text-center mt-4">
              <span className="text-4xl font-bold">R$29</span>
              <span className="text-gray-600">/mês</span>
            </p>
          </div>
          
          <div className="p-6">
            <ul className="space-y-3">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span><strong>20 análises</strong> por mês</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Histórico completo</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Análise avançada</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Exportação de relatórios</span>
              </li>
              <li className="flex items-center text-gray-400">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <span>Dashboard de equipe</span>
              </li>
            </ul>
            
            <button className="w-full mt-8 py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition duration-300">
              Assinar Pro
            </button>
          </div>
        </div>
        
        {/* Plano Equipes */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 bg-gray-50">
            <h2 className="text-2xl font-bold text-center">Equipes</h2>
            <p className="text-center text-gray-600 mt-2">Para times de vendas</p>
            <p className="text-center mt-4">
              <span className="text-4xl font-bold">R$99</span>
              <span className="text-gray-600">/mês</span>
            </p>
          </div>
          
          <div className="p-6">
            <ul className="space-y-3">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span><strong>100 análises</strong> por mês</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Histórico completo</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Análise avançada</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Exportação de relatórios</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Dashboard de equipe</span>
              </li>
            </ul>
            
            <button className="w-full mt-8 py-3 px-4 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition duration-300">
              Assinar Equipes
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes</h2>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Como funciona o limite de análises?</h3>
            <p className="text-gray-600">
              Cada plano oferece um número específico de análises por mês. Uma análise é contabilizada cada vez que você submete uma transcrição para processamento. O contador é renovado no início de cada ciclo de faturamento.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Posso mudar de plano a qualquer momento?</h3>
            <p className="text-gray-600">
              Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças entram em vigor imediatamente, com ajustes proporcionais na cobrança.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Existe um período de teste?</h3>
            <p className="text-gray-600">
              Sim, oferecemos um plano gratuito com 3 análises por mês para que você possa testar o sistema. Além disso, garantimos reembolso em até 7 dias para os planos pagos caso não esteja satisfeito.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanosPage;
