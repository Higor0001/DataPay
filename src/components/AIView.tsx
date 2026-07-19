'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import {
  MessageSquareCode,
  Send,
  Sparkles,
  RefreshCw,
  TrendingDown,
  Percent,
  PiggyBank,
  ChevronRight,
  ShieldCheck,
  BrainCircuit
} from 'lucide-react';

export const AIView: React.FC = () => {
  const { messages, askAI, resetData } = useAppState();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    'Qual dívida devo pagar primeiro?',
    'Se eu receber um dinheiro extra onde investir?',
    'O banco está cobrando juros abusivos?',
    'Quanto economizo antecipando parcelas?',
    'Quanto falta para quitar tudo?',
    'Posso comprar uma TV de R$2.500 agora?',
    'Vale a pena renegociar minhas dívidas?'
  ];

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    askAI(input);
    setInput('');
    setIsTyping(true);
    
    // Simulate thinking delay
    setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleSuggestionClick = (sug: string) => {
    setInput(sug);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 text-slate-100 h-[calc(100vh-4rem)] lg:h-screen">
      
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-2.5 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/10">
            <BrainCircuit className="h-5.5 w-5.5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>Assistente Financeiro IA</span>
              <span className="text-[9px] uppercase tracking-wider bg-indigo-950 border border-indigo-900/60 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded-md">
                Online
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">Consultoria inteligente baseada em algoritmos de desalavancagem</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10.5px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Informações anônimas e protegidas</span>
        </div>
      </div>

      {/* Main content grid split (Chat & suggestions side) */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Suggested Queries panel - left side on large screens */}
        <div className="hidden md:flex flex-col w-72 border-r border-slate-850 p-5 space-y-4 bg-slate-950 overflow-y-auto">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
            <span>Consultas Recomendadas</span>
          </div>
          
          <div className="space-y-2">
            {suggestions.map((sug) => (
              <button
                key={sug}
                onClick={() => handleSuggestionClick(sug)}
                className="w-full text-left p-3.5 bg-slate-900/45 hover:bg-indigo-950/20 border border-slate-900 hover:border-indigo-900/40 rounded-2xl text-[11px] text-slate-300 font-medium transition-all duration-150 flex justify-between items-start gap-2 group cursor-pointer"
              >
                <span>{sug}</span>
                <ChevronRight className="h-4 w-4 text-slate-650 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5" />
              </button>
            ))}
          </div>

          <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl text-[10.5px] text-slate-400 leading-relaxed">
            💡 **Estratégias Avançadas:** Pergunte sobre o método *Avalanche de Juros* ou peça uma auditoria sobre *Juros Abusivos*.
          </div>
        </div>

        {/* Message logs area - right/center side */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/20">
          
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin"
          >
            {messages.map((msg) => {
              const isAI = msg.sender === 'ai';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
                >
                  <div className={`max-w-2xl flex items-start gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                    
                    {/* Avatar */}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      isAI 
                        ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white' 
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {isAI ? 'IA' : 'HI'}
                    </div>

                    {/* Bubble */}
                    <div className={`p-4 rounded-3xl text-xs leading-relaxed ${
                      isAI 
                        ? 'bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-sm' 
                        : 'bg-indigo-650 text-white rounded-tr-sm shadow-md shadow-indigo-600/10'
                    }`}>
                      {isAI ? (
                        <div className="prose prose-invert max-w-none text-slate-200">
                          {msg.text.split('\n').map((line, idx) => {
                            // Check bold formatting **text**
                            const boldRegex = /\*\*(.*?)\*\*/g;
                            const formatted = line.replace(boldRegex, '<strong>$1</strong>');
                            
                            // Check numeric list formatting
                            if (line.trim().match(/^\d+\./)) {
                              return <p key={idx} className="pl-4 -indent-4 mb-2 font-medium" dangerouslySetInnerHTML={{ __html: formatted }} />;
                            }
                            
                            return <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: formatted }} />;
                          })}
                        </div>
                      ) : (
                        <p>{msg.text}</p>
                      )}
                      
                      <span className="text-[8.5px] text-slate-450 block mt-2 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}

            {/* AI Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    IA
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-3xl rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggested Queries list - visible on mobile screen only */}
          <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 border-t border-slate-900 bg-slate-950 scrollbar-none">
            {suggestions.slice(0, 4).map((sug) => (
              <button
                key={sug}
                onClick={() => handleSuggestionClick(sug)}
                className="bg-slate-900/60 border border-slate-850 px-3.5 py-1.5 rounded-full text-[10px] text-slate-300 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-800"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Form Input footer */}
          <form 
            onSubmit={handleSubmit}
            className="p-4 border-t border-slate-850 bg-slate-950 flex gap-2.5"
          >
            <input
              type="text"
              placeholder="Pergunte ao seu assistente financeiro..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md shadow-indigo-600/10 hover:scale-[1.02]"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
};
