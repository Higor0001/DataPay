'use client';

import React, { useState, useEffect } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';

interface OpenFinanceConnectProps {
  onSuccess?: (itemData: any) => void;
  onError?: (error: any) => void;
}

export function OpenFinanceConnect({ onSuccess, onError }: OpenFinanceConnectProps) {
  const [connectToken, setConnectToken] = useState('');
  const [errorState, setErrorState] = useState('');

  useEffect(() => {
    // Efetua uma chamada POST para buscar o token seguro do backend
    fetch('/api/connect-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientUserId: 'user_datapay_higor' // Identificador opcional do usuário local
      })
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Não foi possível gerar o token de sessão do Open Finance no servidor.');
        }
        return res.json();
      })
      .then((data) => {
        if (data.accessToken) {
          setConnectToken(data.accessToken);
        } else {
          throw new Error('Token de acesso não retornado pela API.');
        }
      })
      .catch((err) => {
        console.error('Erro ao inicializar Pluggy Widget:', err);
        setErrorState(err.message);
      });
  }, []);

  if (errorState) {
    return (
      <div className="bg-red-950/20 border border-red-900/50 p-5 rounded-2xl text-center text-xs text-red-400">
        <p className="font-bold">Falha na Inicialização</p>
        <p className="mt-1 text-[11px] text-slate-450">{errorState}</p>
      </div>
    );
  }

  if (!connectToken) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-450 font-medium">Conectando ao canal seguro do Open Finance...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-3xl overflow-hidden min-h-[500px] border border-slate-800">
      <PluggyConnect
        connectToken={connectToken}
        includeSandbox={true}
        onSuccess={(itemData) => {
          console.log('Conexão estabelecida com sucesso no Open Finance:', itemData);
          if (onSuccess) onSuccess(itemData);
        }}
        onError={(error: any) => {
          console.error('Falha na autenticação do banco. Detalhes:', {
            message: error?.message,
            code: error?.code,
            details: error?.error || error
          });
          if (onError) onError(error);
        }}
      />
    </div>
  );
}
