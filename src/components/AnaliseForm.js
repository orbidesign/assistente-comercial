import React, { useState } from 'react';
import { analisarTranscricao } from '../services/openaiService';
import { salvarAnalise } from '../services/supabaseService';

const AnaliseForm = () => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [transcricao, setTranscricao] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!meetingTitle || !transcricao) {
      setError('Por favor, preencha o título da reunião e a transcrição.');
      return;
    }
    
    if (transcricao.length < 100) {
      setError('A transcrição é muito curta. Por favor, forneça uma transcrição mais detalhada.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Analisar a transcrição
      const analise = await analisarTranscricao(transcricao);
      
      // Simular salvamento (em um ambiente real, usaríamos o ID do usuário logado)
      const userId = 'user-123'; // Simulado para o MVP
      const analiseCompleta = {
        meeting_title: meetingTitle,
        client_name: clientName,
        transcript_text: transcricao,
        closing_chance: analise.chanceFechamento,
        strategy_text: analise.estrategia,
        feedback_text: analise.feedback
      };
      
      // Salvar a análise
      const analisesSalva = await salvarAnalise(analiseCompleta, userId);
      
      // Atualizar o estado com o resultado
      setResultado(analise);
    } catch (err) {
      console.error('Erro ao analisar transcrição:', err);
      setError(err.message || 'Ocorreu um erro ao analisar a transcrição. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Análise de Reunião de Vendas</h1>
      
      {!resultado ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="meetingTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Título da Reunião *
            </label>
            <input
              type="text"
              id="meetingTitle"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Apresentação para Empresa XYZ"
              required
            />
          </div>
          
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Cliente (opcional)
            </label>
            <input
              type="text"
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: João Silva"
            />
          </div>
          
          <div>
            <label htmlFor="transcricao" className="block text-sm font-medium text-gray-700 mb-1">
              Transcrição da Reunião *
            </label>
            <textarea
              id="transcricao"
              value={transcricao}
              onChange={(e) => setTranscricao(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Cole aqui a transcrição da sua reunião de vendas..."
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Dica: Para melhores resultados, inclua a transcrição completa da reunião, identificando quem está falando em cada momento.
            </p>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-md text-white font-medium ${
                isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
              } transition duration-300`}
            >
              {isLoading ? 'Analisando...' : 'Analisar Reunião'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Resultados da Análise</h2>
            <button
              onClick={() => setResultado(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              Nova Análise
            </button>
          </div>
          
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-xl font-semibold text-blue-800 mb-4">Chance de Fechamento</h3>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${
                    resultado.chanceFechamento > 70
                      ? 'bg-green-600'
                      : resultado.chanceFechamento > 40
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${resultado.chanceFechamento}%` }}
                />
              </div>
              <span className="ml-4 text-2xl font-bold">{resultado.chanceFechamento}%</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-xl font-semibold text-green-800 mb-4">Estratégia Recomendada</h3>
              <p className="whitespace-pre-line">{resultado.estrategia}</p>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-xl font-semibold text-purple-800 mb-4">Feedback de Performance</h3>
              <p className="whitespace-pre-line">{resultado.feedback}</p>
            </div>
          </div>
          
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setResultado(null)}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-300"
            >
              Analisar Nova Reunião
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnaliseForm;
