'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShoppingBag, Plus, ListFilter, DollarSign, LogOut, Upload, Camera, 
  Trash2, Eye, EyeOff, Save, CheckCircle, Clock, Truck, Package, ArrowRight,
  TrendingUp, BarChart3, X
} from 'lucide-react';

interface Produto {
  id?: string;
  nome: string;
  descricao: string;
  preco_venda: number;
  preco_custo: number;
  tamanhos: string[];
  imagens: string[];
  peso_g: number;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
  ativo: boolean;
  categoria?: string;
}

interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  quantidade: number;
  tamanho_selecionado: string;
  preco_venda_unitario: number;
  preco_custo_unitario: number;
}

interface Pedido {
  id: string;
  codigo_pedido: number;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_whatsapp: string;
  cliente_email: string;
  tipo_entrega: string;
  total_pedido: number;
  status: string;
  codigo_rastreio?: string;
  forma_pagamento: string;
  taxa_gateway_paga: number;
  created_at: string;
  itens_pedido?: PedidoItem[];
}

export default function AdminPage() {
  // Autenticação
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Dashboard Tabs: 'produtos' | 'novo-produto' | 'pedidos' | 'clientes' | 'financeiro'
  const [activeTab, setActiveTab] = useState<'produtos' | 'novo-produto' | 'pedidos' | 'clientes' | 'financeiro'>('produtos');

  // Estado dos Produtos
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulário de Cadastro
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [tamanhosSelecionados, setTamanhosSelecionados] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('Dia a Dia');
  const [pesoG, setPesoG] = useState('200');
  const [compCm, setCompCm] = useState('20');
  const [largCm, setLargCm] = useState('15');
  const [altCm, setAltCm] = useState('10');
  const [imagensUrls, setImagensUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Estado dos Pedidos
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedLoading, setPedLoading] = useState(false);
  const [updatingPedidoId, setUpdatingPedidoId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [searchCliente, setSearchCliente] = useState('');

  // Carregar sessão auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Buscar produtos e pedidos se autenticado
  useEffect(() => {
    if (session) {
      loadProdutos();
      loadPedidos();
    }
  }, [session]);

  const loadProdutos = async () => {
    setProdLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProdutos(data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setProdLoading(false);
    }
  };

  const loadPedidos = async () => {
    setPedLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, itens_pedido(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPedidos(data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setPedLoading(false);
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setLoginError(err.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Upload de Imagens com Compressão Client-side para WebP
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploadingImage(true);

    try {
      // 1. Ler e comprimir a imagem via HTML5 Canvas
      const compressedBlob = await compressImageToWebP(file);

      // 2. Upload para o Supabase Storage
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
      const { data, error } = await supabase.storage
        .from('fotos-produtos')
        .upload(fileName, compressedBlob, {
          contentType: 'image/webp',
          cacheControl: '3600'
        });

      if (error) throw error;

      // 3. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('fotos-produtos')
        .getPublicUrl(fileName);

      setImagensUrls(prev => [...prev, publicUrl]);
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Função helper de compressão de imagem usando Canvas
  const compressImageToWebP = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Limitar tamanho máximo para 1000px de largura/altura para manter leve
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Exportar como WebP de alta qualidade (80%)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Erro ao converter imagem no Canvas.'));
              }
            },
            'image/webp',
            0.8
          );
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Cadastrar Produto
  const handleCreateProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tamanhosSelecionados.length === 0) {
      alert('Selecione ao menos um tamanho.');
      return;
    }
    if (imagensUrls.length === 0) {
      alert('Faça upload de ao menos uma foto.');
      return;
    }

    setIsSubmitting(true);

    const payload: Produto = {
      nome,
      descricao,
      preco_venda: parseFloat(precoVenda),
      preco_custo: parseFloat(precoCusto),
      tamanhos: tamanhosSelecionados,
      imagens: imagensUrls,
      peso_g: parseInt(pesoG),
      comprimento_cm: parseInt(compCm),
      largura_cm: parseInt(largCm),
      altura_cm: parseInt(altCm),
      ativo: true,
      categoria
    };

    try {
      const { error } = await supabase
        .from('produtos')
        .insert([payload]);

      if (error) throw error;

      alert('Produto cadastrado com sucesso!');
      
      // Limpar formulário
      setNome('');
      setDescricao('');
      setPrecoVenda('');
      setPrecoCusto('');
      setTamanhosSelecionados([]);
      setImagensUrls([]);
      
      loadProdutos();
      setActiveTab('produtos');
    } catch (err: any) {
      alert('Erro ao salvar produto: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Status do Produto
  const toggleProdutoAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: !currentAtivo })
        .eq('id', id);
      if (error) throw error;
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, ativo: !currentAtivo } : p));
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  // Deletar Produto
  const handleDeleteProduto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setProdutos(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  // Atualizar Status do Pedido
  const handleUpdatePedido = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus, codigo_rastreio: trackingCode })
        .eq('id', id);
      if (error) throw error;

      alert('Pedido atualizado com sucesso!');
      setUpdatingPedidoId(null);
      loadPedidos();
    } catch (err: any) {
      alert('Erro ao atualizar: ' + err.message);
    }
  };

  // Cálculos Financeiros
  const pedidosFiltro = pedidos.filter(p => p.status === 'pago' || p.status === 'enviado' || p.status === 'entregue');

  const totalFaturamento = pedidosFiltro.reduce((acc, p) => acc + Number(p.total_pedido), 0);

  const totalGatewayTaxas = pedidosFiltro.reduce((acc, p) => acc + Number(p.taxa_gateway_paga || 0), 0);

  const totalCMV = pedidosFiltro.reduce((acc, p) => {
    const custoItens = p.itens_pedido?.reduce((sum, item) => sum + (Number(item.preco_custo_unitario || 0) * item.quantidade), 0) || 0;
    return acc + custoItens;
  }, 0);

  const lucroLiquidoTotal = totalFaturamento - totalGatewayTaxas - totalCMV;

  // Extração e consolidação de Clientes Únicos
  const listaClientes = React.useMemo(() => {
    const clientesMap: { 
      [cpf: string]: { 
        nome: string; 
        cpf: string; 
        whatsapp: string; 
        email: string; 
        totalGasto: number; 
        totalPedidos: number; 
        ultimaCompra: string 
      } 
    } = {};

    pedidos.forEach(p => {
      const cpf = p.cliente_cpf ? p.cliente_cpf.replace(/\D/g, '') : 'sem-cpf';
      const total = (p.status === 'pago' || p.status === 'enviado' || p.status === 'entregue') ? Number(p.total_pedido) : 0;

      if (clientesMap[cpf]) {
        clientesMap[cpf].totalPedidos += 1;
        clientesMap[cpf].totalGasto += total;
        if (new Date(p.created_at) > new Date(clientesMap[cpf].ultimaCompra)) {
          clientesMap[cpf].ultimaCompra = p.created_at;
        }
      } else {
        clientesMap[cpf] = {
          nome: p.cliente_nome,
          cpf: p.cliente_cpf,
          whatsapp: p.cliente_whatsapp,
          email: p.cliente_email || 'Não informado',
          totalPedidos: 1,
          totalGasto: total,
          ultimaCompra: p.created_at
        };
      }
    });

    const lista = Object.values(clientesMap);
    
    if (searchCliente.trim() !== '') {
      const q = searchCliente.toLowerCase();
      return lista.filter(c => 
        c.nome.toLowerCase().includes(q) || 
        c.cpf.includes(q) || 
        c.email.toLowerCase().includes(q) ||
        c.whatsapp.includes(q)
      );
    }
    
    return lista.sort((a, b) => b.totalGasto - a.totalGasto);
  }, [pedidos, searchCliente]);

  // Simulação de recebimento no formulário de cadastro
  const valorVendaNum = parseFloat(precoVenda) || 0;
  const valorCustoNum = parseFloat(precoCusto) || 0;
  
  // Taxas padrão Asaas
  const taxaPix = 0.99;
  const taxaCartaoVista = (valorVendaNum * 0.0299) + 0.40;
  const taxaCartaoFinanciado = (valorVendaNum * 0.0399) + 0.40; // Simulação simples parcelado

  const lucroPix = valorVendaNum > 0 ? (valorVendaNum - valorCustoNum - taxaPix) : 0;
  const lucroCartao = valorVendaNum > 0 ? (valorVendaNum - valorCustoNum - taxaCartaoVista) : 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-sm font-semibold tracking-wide">Carregando painel administrativo...</p>
      </div>
    );
  }

  // Renderizar Tela de Login se não estiver autenticado
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-rose-500 tracking-tight">🍼 Mini Closet</h2>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Painel Administrativo</span>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Senha</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
              />
            </div>

            {loginError && (
              <p className="text-xs font-bold text-rose-400 text-center">{loginError}</p>
            )}

            <button 
              type="submit" 
              className="bg-rose-500 hover:bg-rose-600 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer mt-2"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header Admin */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-rose-500 tracking-tight flex items-center gap-1.5">
              🍼 Mini Closet <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest font-black">Admin</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">{session.user.email}</span>
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-all cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Menu */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 flex gap-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('produtos')}
            className={`py-3.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'produtos' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Produtos
          </button>
          <button 
            onClick={() => setActiveTab('novo-produto')}
            className={`py-3.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'novo-produto' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Cadastrar Produto
          </button>
          <button 
            onClick={() => setActiveTab('pedidos')}
            className={`py-3.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'pedidos' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`py-3.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'clientes' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Clientes
          </button>
          <button 
            onClick={() => setActiveTab('financeiro')}
            className={`py-3.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'financeiro' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Relatórios Financ.
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        
        {/* TAB 1: LISTAGEM PRODUTOS */}
        {activeTab === 'produtos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white">Todos os Produtos</h2>
              <button 
                onClick={() => setActiveTab('novo-produto')}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Novo Produto
              </button>
            </div>

            {prodLoading ? (
              <p className="text-slate-500 text-xs py-10">Carregando lista de produtos...</p>
            ) : produtos.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-3xl">
                <p className="text-slate-500 text-sm">Nenhum produto cadastrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {produtos.map(p => (
                  <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex gap-4 items-center">
                    <img 
                      src={p.imagens[0]} 
                      alt={p.nome} 
                      className="w-20 h-20 object-cover rounded-xl bg-slate-950 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-white text-sm truncate">{p.nome}</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => toggleProdutoAtivo(p.id!, p.ativo)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${p.ativo ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-850 text-slate-500 hover:bg-slate-800'}`}
                            title={p.ativo ? 'Ativo (Clique para pausar)' : 'Pausado (Clique para ativar)'}
                          >
                            {p.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleDeleteProduto(p.id!)}
                            className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider block mt-0.5">{p.categoria}</span>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">Preço Venda</span>
                          <span className="text-sm font-black text-slate-200">R$ {p.preco_venda.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">Preço Custo</span>
                          <span className="text-sm font-bold text-slate-400">R$ {p.preco_custo.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">Tamanhos</span>
                          <span className="text-xs font-bold text-slate-300">{p.tamanhos.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CADASTRAR PRODUTO */}
        {activeTab === 'novo-produto' && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-xl font-bold tracking-tight text-white mb-6">Cadastrar Roupinha</h2>

            <form onSubmit={handleCreateProduto} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-5 shadow-lg">
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Título do Produto *</label>
                <input 
                  type="text" 
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Vestido Floral Infantil"
                  className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Dizeres / Descrição *</label>
                <textarea 
                  required
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhe o tecido, modelagem, conforto e detalhes da peça..."
                  className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Preço de Venda (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(e.target.value)}
                    placeholder="99.90"
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Preço de Custo (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={precoCusto}
                    onChange={(e) => setPrecoCusto(e.target.value)}
                    placeholder="35.00"
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
                  />
                </div>
              </div>

              {/* Simulador de Recebível Líquido e Margem */}
              {valorVendaNum > 0 && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Simulador de Margem Líquida</span>
                  <div className="grid grid-cols-2 gap-4 text-xs mt-1">
                    <div className="border-r border-slate-800 pr-2">
                      <span className="text-slate-400 block">Venda via Pix (Asaas):</span>
                      <span className="font-extrabold text-slate-200 block">Recebe: R$ {(valorVendaNum - taxaPix).toFixed(2)}</span>
                      <span className={`font-black ${lucroPix > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Lucro: R$ {lucroPix.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Venda via Cartão (Asaas):</span>
                      <span className="font-extrabold text-slate-200 block">Recebe: R$ {(valorVendaNum - taxaCartaoVista).toFixed(2)}</span>
                      <span className={`font-black ${lucroCartao > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Lucro: R$ {lucroCartao.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Categoria *</label>
                <select 
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-sm"
                >
                  <option value="Bebês">Bebês</option>
                  <option value="Meninos">Meninos</option>
                  <option value="Meninas">Meninas</option>
                  <option value="Festa">Festa</option>
                  <option value="Dia a Dia">Dia a Dia</option>
                </select>
              </div>

              {/* Seleção de Tamanhos */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Tamanhos Disponíveis *</label>
                <div className="flex flex-wrap gap-2">
                  {['RN', '3 meses', '6 meses', '12 meses', '1 ano', '2 anos', '3 anos', '4 anos', '6 anos', '8 anos'].map(sz => {
                    const selected = tamanhosSelecionados.includes(sz);
                    return (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => {
                          setTamanhosSelecionados(prev => 
                            selected ? prev.filter(t => t !== sz) : [...prev, sz]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selected ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-850'}`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload de Imagens com Câmera */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Fotos do Produto (WebP Compactado) *</label>
                <div className="flex flex-wrap gap-4 items-center">
                  
                  {/* Pré-visualizações */}
                  {imagensUrls.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0">
                      <img src={url} alt="Envio" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImagensUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-slate-950/80 hover:bg-slate-900 p-1 rounded-full text-rose-400 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Botão de Upload */}
                  <label className="w-20 h-20 bg-slate-950 hover:bg-slate-900 rounded-xl border-2 border-dashed border-slate-800 hover:border-rose-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all">
                    {uploadingImage ? (
                      <span className="text-[10px] text-slate-500 font-bold tracking-wide animate-pulse">Enviando...</span>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-slate-400" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Tirar Foto</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>

                </div>
              </div>

              {/* Dados Físicos para Envio */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col gap-4">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Dados de Embalagem (Frete)</span>
                
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">Peso (g)</label>
                    <input 
                      type="number" 
                      value={pesoG} 
                      onChange={(e) => setPesoG(e.target.value)} 
                      className="w-full bg-slate-900 text-white px-2 py-1.5 rounded-lg border border-slate-800 text-center text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Comp (cm)</label>
                    <input 
                      type="number" 
                      value={compCm} 
                      onChange={(e) => setCompCm(e.target.value)} 
                      className="w-full bg-slate-900 text-white px-2 py-1.5 rounded-lg border border-slate-800 text-center text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Larg (cm)</label>
                    <input 
                      type="number" 
                      value={largCm} 
                      onChange={(e) => setLargCm(e.target.value)} 
                      className="w-full bg-slate-900 text-white px-2 py-1.5 rounded-lg border border-slate-800 text-center text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Alt (cm)</label>
                    <input 
                      type="number" 
                      value={altCm} 
                      onChange={(e) => setAltCm(e.target.value)} 
                      className="w-full bg-slate-900 text-white px-2 py-1.5 rounded-lg border border-slate-800 text-center text-xs" 
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || uploadingImage}
                className="bg-rose-500 hover:bg-rose-600 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer mt-4"
              >
                {isSubmitting ? 'Salvando...' : 'Cadastrar Roupinha'}
              </button>

            </form>
          </div>
        )}

        {/* TAB 3: PEDIDOS */}
        {activeTab === 'pedidos' && (
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-6">Pedidos Recebidos</h2>

            {pedLoading ? (
              <p className="text-slate-500 text-xs py-10">Carregando pedidos...</p>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-3xl">
                <p className="text-slate-500 text-sm">Nenhum pedido recebido ainda.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pedidos.map(p => (
                  <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                    
                    {/* Top Bar Pedido */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                      <div>
                        <span className="font-extrabold text-white text-sm">Pedido #{p.codigo_pedido}</span>
                        <span className="text-[10px] text-slate-500 block">{new Date(p.created_at).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {p.status === 'pago' && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Pago</span>}
                        {p.status === 'aguardando_pagamento' && <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Aguardando Pgto</span>}
                        {p.status === 'enviado' && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Enviado</span>}
                      </div>
                    </div>

                    {/* Detalhes do Cliente */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block">Cliente:</span>
                        <span className="font-semibold text-slate-200">{p.cliente_nome}</span>
                        <span className="text-slate-400 block mt-1">{p.cliente_whatsapp}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">Entrega:</span>
                        <span className="font-semibold text-slate-200 uppercase">{p.tipo_entrega}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">Total do Pedido:</span>
                        <span className="font-black text-sm text-slate-100">R$ {Number(p.total_pedido).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Itens do Pedido */}
                    {p.itens_pedido && p.itens_pedido.length > 0 && (
                      <div className="bg-slate-950/45 border border-slate-800/80 rounded-xl p-3 text-xs">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Itens para Embalar:</span>
                        <div className="flex flex-col gap-2">
                          {p.itens_pedido.map((item) => {
                            const prod = produtos.find(pr => pr.id === item.produto_id);
                            return (
                              <div key={item.id} className="flex justify-between items-center text-slate-300">
                                <div>
                                  <span className="font-bold text-white">{prod?.nome || 'Produto Descontinuado'}</span>
                                  <span className="text-slate-500 mx-2">|</span>
                                  <span>Tamanho: <span className="font-semibold text-rose-400">{item.tamanho_selecionado}</span></span>
                                  <span className="text-slate-500 mx-2">|</span>
                                  <span>Qtd: <span className="font-semibold text-slate-100">{item.quantidade}</span></span>
                                </div>
                                <span className="font-mono text-slate-400">R$ {Number(item.preco_venda_unitario * item.quantidade).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ações / Atualização */}
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                      <div className="w-full md:max-w-xs flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">Mudar Status</label>
                          <select 
                            defaultValue={p.status}
                            onChange={(e) => {
                              setNewStatus(e.target.value);
                              setUpdatingPedidoId(p.id);
                            }}
                            className="bg-slate-900 text-white text-xs border border-slate-800 rounded-lg p-2 w-full focus:outline-hidden"
                          >
                            <option value="aguardando_pagamento">Aguardando Pagamento</option>
                            <option value="pago">Pago / Separando</option>
                            <option value="pronto_para_retirada">Pronto para Retirada</option>
                            <option value="enviado">Enviado / Rastreamento</option>
                            <option value="entregue">Entregue</option>
                          </select>
                        </div>
                        {updatingPedidoId === p.id && (
                          <button 
                            onClick={() => handleUpdatePedido(p.id)}
                            className="bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer self-end h-9"
                          >
                            <Save className="w-4 h-4" /> Salvar
                          </button>
                        )}
                      </div>

                      {p.tipo_entrega === 'envio' && (
                        <div className="w-full md:max-w-xs">
                          <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">Código de Rastreio</label>
                          <input 
                            type="text" 
                            defaultValue={p.codigo_rastreio || ''}
                            onChange={(e) => {
                              setTrackingCode(e.target.value);
                              setNewStatus('enviado');
                              setUpdatingPedidoId(p.id);
                            }}
                            placeholder="Ex: PM123456789BR"
                            className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-800 text-xs focus:outline-hidden"
                          />
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-6">Relatório de Faturamento e Lucro</h2>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
              
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Faturamento Bruto</span>
                  <span className="text-xl font-black text-white mt-1 block">R$ {totalFaturamento.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Taxas Gateway</span>
                  <span className="text-xl font-black text-rose-450 mt-1 block">R$ {totalGatewayTaxas.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Custo de Estoque (CMV)</span>
                  <span className="text-xl font-black text-amber-550 mt-1 block">R$ {totalCMV.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
                  <Package className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Lucro Líquido Real</span>
                  <span className={`text-xl font-black mt-1 block ${lucroLiquidoTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    R$ {lucroLiquidoTotal.toFixed(2)}
                  </span>
                  {totalFaturamento > 0 && (
                    <span className="text-[9px] font-bold text-slate-400">
                      Margem: {((lucroLiquidoTotal / totalFaturamento) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className={`p-3 rounded-2xl ${lucroLiquidoTotal >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <h3 className="font-extrabold text-white text-md mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-rose-500" /> Detalhamento de Operações Liquidadas</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Este relatório compila apenas pedidos com status pagos, enviados ou entregues. Os valores de lucro líquido são calculados deduzindo as taxas reais capturadas e o custo cadastrado dos itens.
              </p>
              
              {pedidosFiltro.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhum pedido liquidado disponível no momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="pb-3">Pedido</th>
                        <th className="pb-3">Data</th>
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Faturamento</th>
                        <th className="pb-3">Taxa Asaas</th>
                        <th className="pb-3">CMV</th>
                        <th className="pb-3 text-right">Lucro Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {pedidosFiltro.map((p) => {
                        const orderCMV = p.itens_pedido?.reduce((sum, item) => sum + (Number(item.preco_custo_unitario || 0) * item.quantidade), 0) || 0;
                        const orderLucro = Number(p.total_pedido) - Number(p.taxa_gateway_paga || 0) - orderCMV;
                        return (
                          <tr key={p.id} className="hover:bg-slate-850/40">
                            <td className="py-3.5 font-bold text-white">#{p.codigo_pedido}</td>
                            <td className="py-3.5 text-slate-400">{new Date(p.created_at).toLocaleDateString()}</td>
                            <td className="py-3.5">{p.cliente_nome}</td>
                            <td className="py-3.5 font-semibold text-slate-200">R$ {Number(p.total_pedido).toFixed(2)}</td>
                            <td className="py-3.5 text-rose-400">R$ {Number(p.taxa_gateway_paga || 0).toFixed(2)}</td>
                            <td className="py-3.5 text-amber-400">R$ {orderCMV.toFixed(2)}</td>
                            <td className={`py-3.5 text-right font-black ${orderLucro >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                              R$ {orderLucro.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: LISTAGEM CLIENTES */}
        {activeTab === 'clientes' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white">Base de Clientes</h2>
              
              {/* Barra de Busca de Clientes */}
              <div className="w-full md:max-w-xs relative">
                <input 
                  type="text" 
                  value={searchCliente}
                  onChange={(e) => setSearchCliente(e.target.value)}
                  placeholder="Buscar por nome, CPF ou e-mail..."
                  className="w-full bg-slate-900 text-white pl-4 pr-10 py-2.5 rounded-xl border border-slate-800 focus:outline-hidden focus:border-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              {listaClientes.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhum cliente cadastrado ou localizado na busca.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="pb-3">Nome / E-mail</th>
                        <th className="pb-3">CPF</th>
                        <th className="pb-3">WhatsApp</th>
                        <th className="pb-3 text-center">Pedidos Realizados</th>
                        <th className="pb-3 text-center">Última Compra</th>
                        <th className="pb-3 text-right">LTV (Total Gasto)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {listaClientes.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-850/40">
                          <td className="py-3.5">
                            <span className="font-bold text-white block">{c.nome}</span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">{c.email}</span>
                          </td>
                          <td className="py-3.5 font-mono text-slate-400">{c.cpf}</td>
                          <td className="py-3.5">
                            <a
                              href={`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded-md transition-all font-semibold"
                            >
                              <span>{c.whatsapp}</span>
                            </a>
                          </td>
                          <td className="py-3.5 text-center font-bold text-slate-200">{c.totalPedidos}</td>
                          <td className="py-3.5 text-center text-slate-400">
                            {new Date(c.ultimaCompra).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 text-right font-black text-emerald-400">
                            R$ {c.totalGasto.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
