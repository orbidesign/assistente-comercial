import React, { useState, useEffect } from 'react';
import { obterHistoricoAnalises } from '../services/supabaseService';

const DashboardPage = () => {
  const [analises, setAnalises] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState({
    nome: 'Usuário',
    plano: 'free',
    analises_restantes: 3,
    analises_total: 3
  });

  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Em um app real, verificaríamos se o usuário está autenticado
        // e obteríamos o ID do usuário da sessão
        const userId = 'user-123'; // Simulado para o MVP
        
        const historicoAnalises = await obterHistoricoAnalises(userId);
        setAnalises(historicoAnalises);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Não foi possível carregar os dados. Por favor, tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    carregarDados();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      ) : (
        <>
          {/* Estatísticas do Usuário */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold mb-4">Seu Plano</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">Plano Atual</p>
                <p className="text-2xl font-bold text-blue-700 capitalize">{usuario.plano}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">Análises Disponíveis</p>
                <p className="text-2xl font-bold text-green-700">{usuario.analises_restantes} de {usuario.analises_total}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">Ações</p>
                <a 
                  href="/planos" 
                  className="text-purple-700 font-medium hover:text-purple-900"
                >
                  Atualizar Plano
                </a>
              </div>
            </div>
          </div>
          
          {/* Histórico de Análises */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Histórico de Análises</h2>
              <a 
                href="/analise" 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
              >
                Nova Análise
              </a>
            </div>
            
            {analises.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Você ainda não realizou nenhuma análise.</p>
                <a 
                  href="/analise" 
                  className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                >
                  Realizar minha primeira análise
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analises.map((analise) => (
                      <tr key={analise.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(analise.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {analise.meeting_title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {analise.client_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            analise.closing_chance > 70
                              ? 'bg-green-100 text-green-800'
                              : analise.closing_chance > 40
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {analise.closing_chance}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <a 
                            href={`/analise/${analise.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Ver Detalhes
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
