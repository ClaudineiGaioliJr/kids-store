'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  CheckCircle2, 
  Clock, 
  Package, 
  Truck, 
  ShoppingBag, 
  ArrowLeft, 
  QrCode, 
  Copy, 
  Check, 
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface PedidoItem {
  id: string;
  produto_id: string | null;
  quantidade: number;
  tamanho_selecionado: string;
  preco_venda_unitario: number;
  produto?: {
    nome: string;
    imagens: string[];
  };
}

interface Pedido {
  id: string;
  codigo_pedido: number;
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email: string | null;
  tipo_entrega: string;
  frete_valor: number;
  frete_prazo: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  total_produtos: number;
  total_pedido: number;
  status: string;
  codigo_rastreio: string | null;
  forma_pagamento: string | null;
  parcelas: number;
  created_at: string;
  itens?: PedidoItem[];
}

export default function PedidoTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const pedidoId = resolvedParams.id;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixDetails, setPixDetails] = useState<{ qrCode: string; copyPaste: string } | null>(null);

  const fetchPedido = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar pedido
      const { data: orderData, error: orderError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (orderError || !orderData) {
        throw new Error('Pedido não localizado ou acesso não autorizado');
      }

      setPedido(orderData);

      // 2. Buscar itens do pedido
      const { data: itemsData, error: itemsError } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', pedidoId);

      if (itemsError) {
        throw new Error('Erro ao carregar itens do pedido');
      }

      // 3. Buscar detalhes adicionais dos produtos correspondentes
      const updatedItens = await Promise.all(
        (itemsData || []).map(async (item: any) => {
          if (item.produto_id) {
            const { data: prodData } = await supabase
              .from('produtos')
              .select('nome, imagens')
              .eq('id', item.produto_id)
              .single();
            if (prodData) {
              return { ...item, produto: prodData };
            }
          }
          return {
            ...item,
            produto: {
              nome: 'Produto Descontinuado',
              imagens: []
            }
          };
        })
      );

      setItens(updatedItens);

      // 4. Se o pedido ainda está aguardando pagamento por Pix, gerar/recuperar dados mock
      if (orderData.status === 'aguardando_pagamento' && orderData.forma_pagamento === 'pix') {
        // Mock de Pix copia-e-cola se não houver gateway real
        const pixCopyPaste = '00020101021226870014br.gov.bcb.pix25650021miniclosetfakekeypix123520400005303986540579.905802BR5911Mini Closet6009Sao Paulo62070503***6304ABCD';
        setPixDetails({
          copyPaste: pixCopyPaste,
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopyPaste)}`
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro de conexão com o banco de dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedido();

    // Inscrição em tempo real para atualizações do pedido
    const channel = supabase
      .channel(`order-updates-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoId}`
        },
        (payload) => {
          console.log('Pedido atualizado em tempo real:', payload.new);
          setPedido(payload.new as Pedido);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  const copyToClipboard = () => {
    if (pixDetails) {
      navigator.clipboard.writeText(pixDetails.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusStep = () => {
    if (!pedido) return 0;
    switch (pedido.status) {
      case 'aguardando_pagamento':
        return 1;
      case 'pago':
        return 2;
      case 'preparando':
        return 3;
      case 'enviado':
        return 4;
      case 'entregue':
      case 'retirado':
        return 5;
      default:
        return 1;
    }
  };

  const getStatusColor = (step: number) => {
    const currentStep = getStatusStep();
    if (currentStep >= step) {
      return 'bg-emerald-500 text-white border-emerald-500';
    }
    return 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
  };

  const getStatusLineColor = (step: number) => {
    const currentStep = getStatusStep();
    if (currentStep > step) {
      return 'bg-emerald-500';
    }
    return 'bg-slate-200 dark:bg-slate-700';
  };

  if (loading && !pedido) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">Buscando detalhes do seu pedido...</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Pedido Não Localizado</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error || 'Não encontramos as informações deste pedido no momento.'}
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para a loja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Header */}
      <header className="sticky top-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar à vitrine</span>
          </Link>
          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400">Pedido</span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">#{pedido.codigo_pedido.toString().padStart(5, '0')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Lado Esquerdo / Principal: Status do Pedido e Pagamento */}
        <div className="md:col-span-2 space-y-6">
          {/* Card Status de Acompanhamento */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Acompanhe seu Pedido</h2>
              <button 
                onClick={fetchPedido}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-500 dark:text-slate-400"
                title="Atualizar Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Linha do Tempo Visual */}
            <div className="relative flex justify-between items-start mb-8 px-2">
              {/* Conectores */}
              <div className="absolute top-4 left-6 right-6 h-0.5 z-0 flex">
                <div className={`h-full transition-all duration-500 ${getStatusLineColor(1)}`} style={{ width: '25%' }} />
                <div className={`h-full transition-all duration-500 ${getStatusLineColor(2)}`} style={{ width: '25%' }} />
                <div className={`h-full transition-all duration-500 ${getStatusLineColor(3)}`} style={{ width: '25%' }} />
                <div className={`h-full transition-all duration-500 ${getStatusLineColor(4)}`} style={{ width: '25%' }} />
              </div>

              {/* Etapa 1: Criado */}
              <div className="flex flex-col items-center text-center relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${getStatusColor(1)}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold mt-2 block">Criado</span>
              </div>

              {/* Etapa 2: Pago */}
              <div className="flex flex-col items-center text-center relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${getStatusColor(2)}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold mt-2 block">Pago</span>
              </div>

              {/* Etapa 3: Preparando */}
              <div className="flex flex-col items-center text-center relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${getStatusColor(3)}`}>
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold mt-2 block">Preparando</span>
              </div>

              {/* Etapa 4: Enviado */}
              <div className="flex flex-col items-center text-center relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${getStatusColor(4)}`}>
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold mt-2 block">Enviado</span>
              </div>

              {/* Etapa 5: Entregue */}
              <div className="flex flex-col items-center text-center relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${getStatusColor(5)}`}>
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold mt-2 block">
                  {pedido.tipo_entrega === 'retirada' ? 'Retirado' : 'Entregue'}
                </span>
              </div>
            </div>

            {/* Descrição do status atual */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm">
              {pedido.status === 'aguardando_pagamento' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-800 dark:text-amber-400">Aguardando Pagamento</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Seu pedido foi registrado! Conclua o pagamento para iniciarmos a separação do seu produto.
                    </p>
                  </div>
                </div>
              )}

              {pedido.status === 'pago' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400 font-medium">Pagamento Confirmado</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Confirmamos o recebimento do seu pagamento! Seu pedido está a caminho da nossa equipe de expedição.
                    </p>
                  </div>
                </div>
              )}

              {pedido.status === 'preparando' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-400 font-medium">Em Preparação</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Sua compra está sendo embalada com todo carinho pela nossa equipe. Em breve será enviada!
                    </p>
                  </div>
                </div>
              )}

              {pedido.status === 'enviado' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-800 dark:text-blue-400 font-medium">Pedido Enviado</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Seu pedido já foi postado! Acompanhe a entrega com o código de rastreamento.
                    </p>
                    {pedido.codigo_rastreio && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-md">
                          Código: {pedido.codigo_rastreio}
                        </span>
                        <a 
                          href={`https://rastreamento.correios.com.br/app/index.php?objeto=${pedido.codigo_rastreio}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700 font-medium"
                        >
                          Rastrear nos Correios
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(pedido.status === 'entregue' || pedido.status === 'retirado') && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400 font-medium">
                      {pedido.status === 'retirado' ? 'Pedido Retirado' : 'Pedido Entregue'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Oba! O pedido foi concluído com sucesso. Esperamos que ame as pecinhas! Volte sempre.
                    </p>
                  </div>
                </div>
              )}

              {pedido.status === 'cancelado' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-rose-800 dark:text-rose-400 font-medium">Pedido Cancelado</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Este pedido foi cancelado devido ao vencimento ou por solicitação do cliente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pix QR Code (Apenas se pendente e via Pix) */}
          {pedido.status === 'aguardando_pagamento' && pedido.forma_pagamento === 'pix' && pixDetails && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/80 shadow-md text-center">
              <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 mb-4 font-bold">
                <QrCode className="w-5 h-5" />
                <span>Pague com PIX</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                Escaneie o código QR abaixo ou copie a chave Pix para concluir o pagamento em segundos.
              </p>

              {/* QR Code */}
              <div className="bg-slate-50 dark:bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner border border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={pixDetails.qrCode} 
                  alt="Pix QR Code" 
                  className="w-48 h-48 mx-auto"
                />
              </div>

              {/* Copia e Cola */}
              <div className="max-w-md mx-auto">
                <label className="block text-xs font-semibold text-slate-500 text-left mb-1.5 ml-1">Código Pix Copia e Cola</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixDetails.copyPaste} 
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs focus:outline-none overflow-ellipsis whitespace-nowrap text-slate-600 dark:text-slate-300"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all shrink-0 active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 text-xs text-amber-500 font-semibold flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>A página atualizará automaticamente após a aprovação</span>
              </div>
            </div>
          )}

          {/* Dados de Entrega / Retirada */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/80 shadow-md">
            <h2 className="text-lg font-bold mb-4">Informações de Entrega</h2>
            {pedido.tipo_entrega === 'retirada' ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-slate-800 dark:text-slate-200">Retirada em Mãos (Loja Física)</p>
                <p className="text-slate-600 dark:text-slate-400">
                  Assim que o pagamento for confirmado, você poderá retirar o seu pedido em nossa loja.
                </p>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 text-xs">
                  <p className="font-bold">Endereço da Loja:</p>
                  <p className="text-slate-600 dark:text-slate-400">Rua das Flores, 123 - Centro - São Paulo/SP</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Horário: Segunda a Sexta das 9h às 18h</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Destinatário</span>
                    <span className="font-medium">{pedido.cliente_nome}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Prazo Estimado</span>
                    <span className="font-medium">{pedido.frete_prazo || '--'} dias úteis</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-xs text-slate-400 block">Endereço de Envio</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {pedido.endereco_rua}, {pedido.numero} {pedido.complemento ? `- ${pedido.complemento}` : ''}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {pedido.bairro} — {pedido.cidade}/{pedido.estado}
                  </p>
                  <p className="text-slate-500 font-mono text-xs mt-1">CEP: {pedido.endereco_cep}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito / Barra Lateral: Resumo dos Itens e Valores */}
        <div className="space-y-6">
          {/* Card Resumo do Carrinho */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/80 shadow-md">
            <h2 className="text-lg font-bold mb-4">Itens do Pedido</h2>
            
            {/* Lista de Itens */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto pr-1">
              {itens.map((item) => (
                <div key={item.id} className="py-3.5 flex gap-3 first:pt-0 last:pb-0">
                  {/* Foto Miniatura */}
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    {item.produto?.imagens && item.produto.imagens.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={item.produto.imagens[0]} 
                        alt={item.produto.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Nome e Tamanho */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.produto?.nome}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Tamanho: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.tamanho_selecionado}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Qtd: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.quantidade}</span>
                    </p>
                  </div>

                  {/* Preço */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(item.preco_venda_unitario * item.quantidade)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totais */}
            <div className="border-t border-slate-100 dark:border-slate-800 mt-4 pt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(pedido.total_produtos))}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Frete</span>
                <span>{pedido.frete_valor > 0 ? formatCurrency(Number(pedido.frete_valor)) : 'Grátis/Retirada'}</span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-between font-bold text-base">
                <span>Total Pago</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(Number(pedido.total_pedido))}</span>
              </div>
            </div>
          </div>

          {/* Dúvidas / Ajuda */}
          <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-950 text-indigo-950 dark:text-indigo-200">
            <h3 className="font-bold text-sm mb-1">Precisa de Ajuda?</h3>
            <p className="text-xs text-indigo-900/75 dark:text-indigo-300/80 mb-4 leading-relaxed">
              Ficou com alguma dúvida sobre o seu pedido ou prazo? Entre em contato diretamente conosco pelo WhatsApp.
            </p>
            <a 
              href={`https://wa.me/55${pedido.cliente_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de informações sobre o meu pedido #${pedido.codigo_pedido.toString().padStart(5, '0')}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#20ba56] text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-white text-[#25D366]" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
