'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBag, Search, X, Check, ArrowRight, MessageSquare, 
  ShieldCheck, Truck, Clipboard, Landmark, CreditCard, ChevronLeft
} from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco_venda: number;
  preco_custo: number;
  tamanhos: string[];
  imagens: string[];
  ativo: boolean;
  categoria?: string; 
}

const MOCK_PRODUTOS: Produto[] = [
  {
    id: 'm1',
    nome: 'Vestido Infantil Floral Primavera',
    descricao: 'Vestido leve 100% algodão com estampa floral delicada. Perfeito para festas e passeios em dias ensolarados.',
    preco_venda: 89.90,
    preco_custo: 35.00,
    tamanhos: ['1 ano', '2 anos', '3 anos', '4 anos'],
    imagens: ['https://images.unsplash.com/photo-1622398926573-65685c7ee0df?w=600&auto=format&fit=crop&q=80'],
    ativo: true,
    categoria: 'Festa'
  },
  {
    id: 'm2',
    nome: 'Conjunto Safari Menino',
    descricao: 'Camisa de botões temática com estampa de animais e bermuda cargo em sarja confortável.',
    preco_venda: 110.00,
    preco_custo: 48.00,
    tamanhos: ['2 anos', '4 anos', '6 anos'],
    imagens: ['https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=600&auto=format&fit=crop&q=80'],
    ativo: true,
    categoria: 'Meninos'
  },
  {
    id: 'm3',
    nome: 'Romper Tricot Candy Color',
    descricao: 'Romper feito à mão em linha antialérgica de tricot soft. Muito charme e conforto para bebês.',
    preco_venda: 79.90,
    preco_custo: 30.00,
    tamanhos: ['RN', '3 meses', '6 meses', '12 meses'],
    imagens: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=80'],
    ativo: true,
    categoria: 'Bebês'
  },
  {
    id: 'm4',
    nome: 'Jardineira Jeans Classic',
    descricao: 'Jardineira unissex jeans com elastano e alças reguláveis. Um clássico que nunca sai de moda.',
    preco_venda: 95.00,
    preco_custo: 40.00,
    tamanhos: ['1 ano', '2 anos', '4 anos', '6 anos'],
    imagens: ['https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=600&auto=format&fit=crop&q=80'],
    ativo: true,
    categoria: 'Dia a Dia'
  }
];

export default function VitrinePage() {
  const [produtos, setProdutos] = useState<Produto[]>(MOCK_PRODUTOS);
  const [search, setSearch] = useState('');
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<{ produto: Produto; tamanho: string; quantidade: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  // Estados de cálculo de frete
  const [cep, setCep] = useState('');
  const [shippingOptions, setShippingOptions] = useState<{ id: any; nome: string; preco: number; prazo: number }[]>([]);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<{ id: any; nome: string; preco: number; prazo: number } | null>(null);
  const [shippingError, setShippingError] = useState('');

  // Checkout Steps: 'carrinho' | 'checkout' | 'sucesso'
  const [cartStep, setCartStep] = useState<'carrinho' | 'checkout' | 'sucesso'>('carrinho');

  // Form Fields do Checkout
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCpf, setClienteCpf] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'envio' | 'retirada'>('envio');

  // Endereço
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao'>('pix');
  const [parcelas, setParcelas] = useState('1');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiryMonth, setCardExpiryMonth] = useState('');
  const [cardExpiryYear, setCardExpiryYear] = useState('');
  const [cardCcv, setCardCcv] = useState('');

  // Submissão do Checkout
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutResult, setCheckoutResult] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const handleCalculateShipping = async () => {
    if (cep.replace(/\D/g, '').length !== 8) {
      setShippingError('Digite um CEP válido com 8 números.');
      return;
    }
    setShippingError('');
    setCalculatingShipping(true);
    setSelectedShipping(null);
    try {
      const response = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cepDestino: cep,
          itens: cart
        })
      });
      if (!response.ok) throw new Error('Erro no cálculo');
      const data = await response.json();
      
      const optionsWithPickup = [
        ...data,
        { id: 'retira', nome: 'Retirar na Loja (Grátis)', preco: 0.00, prazo: 0 }
      ];
      setShippingOptions(optionsWithPickup);
    } catch (err: any) {
      setShippingError('Não foi possível obter opções de envio.');
    } finally {
      setCalculatingShipping(false);
    }
  };

  useEffect(() => {
    async function fetchProdutos() {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('ativo', true);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized: Produto[] = data.map(item => ({
            ...item,
            preco_venda: Number(item.preco_venda),
            preco_custo: Number(item.preco_custo)
          }));
          setProdutos(normalized);
        }
      } catch (err) {
        console.log('Usando produtos mockados (Banco Supabase offline ou sem registros).');
      } finally {
        setDbLoading(false);
      }
    }
    fetchProdutos();
  }, []);

  const produtosFiltrados = produtos.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || 
                          p.descricao.toLowerCase().includes(search.toLowerCase());
    const matchesSize = selectedSize ? p.tamanhos.includes(selectedSize) : true;
    const matchesCategory = selectedCategory ? (p.categoria === selectedCategory) : true;
    return matchesSearch && matchesSize && matchesCategory;
  });

  const todosTamanhos = Array.from(
    new Set(produtos.flatMap(p => p.tamanhos))
  ).sort();

  const categorias = ['Bebês', 'Meninos', 'Meninas', 'Festa', 'Dia a Dia'];

  const addToCart = (produto: Produto, tamanho: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.produto.id === produto.id && item.tamanho === tamanho);
      if (existing) {
        return prev.map(item => 
          item.produto.id === produto.id && item.tamanho === tamanho 
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, tamanho, quantidade: 1 }];
    });
    setCartStep('carrinho');
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string, tamanho: string) => {
    setCart(prev => prev.filter(item => !(item.produto.id === id && item.tamanho === tamanho)));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.produto.preco_venda * item.quantidade, 0);

  // Executar Finalização do Pedido (API Route /api/checkout)
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tipoEntrega === 'envio' && !selectedShipping) {
      alert('Por favor, calcule e selecione uma opção de frete.');
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutError('');

    const payload = {
      clienteNome,
      clienteCpf: clienteCpf.replace(/\D/g, ''),
      clienteWhatsapp: clienteWhatsapp.replace(/\D/g, ''),
      clienteEmail,
      tipoEntrega,
      selectedShipping,
      endereco: tipoEntrega === 'envio' ? {
        cep: cep.replace(/\D/g, ''),
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        estado
      } : null,
      formaPagamento,
      parcelas: formaPagamento === 'cartao' ? Number(parcelas) : 1,
      cart,
      cartaoDados: formaPagamento === 'cartao' ? {
        holderName: cardHolderName,
        number: cardNumber.replace(/\D/g, ''),
        expiryMonth: cardExpiryMonth,
        expiryYear: cardExpiryYear,
        ccv: cardCcv
      } : null
    };

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao processar transação no gateway.');
      }

      setCheckoutResult(resData);
      setCartStep('sucesso');
      setCart([]); // Esvaziar carrinho após sucesso
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Top Banner */}
      <div className="bg-amber-400 text-slate-900 text-center py-2 text-xs font-semibold uppercase tracking-wider">
        ✨ Frete grátis para compras acima de R$ 250! Ou retire em nossa loja física.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-rose-500 tracking-tight flex items-center gap-1">
              🍼 Mini Closet
            </h1>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Moda Infantil Premium</span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {cart.reduce((acc, item) => acc + item.quantidade, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-rose-100/40 py-16 px-4 border-b border-rose-100/50">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-6">
          <span className="bg-rose-200/80 text-rose-600 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Coleção Outono/Inverno 2026
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">
            Roupas confortáveis que dão asas à imaginação
          </h2>
          <p className="text-slate-500 text-sm md:text-base max-w-lg leading-relaxed">
            Peças exclusivas feitas com tecidos hipoalergênicos e acabamento premium para durar muitas brincadeiras.
          </p>
        </div>
      </section>

      {/* Filtros e Busca */}
      <main className="max-w-6xl mx-auto px-4 py-12 flex-1 w-full">
        
        {/* Barra de Busca e Filtros */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          
          {/* Busca */}
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar roupinha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-xl text-sm border border-slate-100 focus:outline-hidden focus:border-rose-300 focus:bg-white transition-all"
            />
          </div>

          {/* Filtros de Tamanho e Categoria */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
            <div className="flex gap-1.5 overflow-x-auto">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${!selectedCategory ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              >
                Todas as categorias
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategory === cat ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtro secundário: Tamanho */}
        <div className="mb-8 flex items-center gap-3 overflow-x-auto pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Tamanho:</span>
          <button 
            onClick={() => setSelectedSize(null)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${!selectedSize ? 'bg-rose-100 border-rose-300 text-rose-600 font-extrabold' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            Tudo
          </button>
          {todosTamanhos.map(sz => (
            <button
              key={sz}
              onClick={() => setSelectedSize(sz)}
              className={`min-w-10 h-10 px-2 rounded-full flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${selectedSize === sz ? 'bg-rose-100 border-rose-300 text-rose-600 font-extrabold' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {sz}
            </button>
          ))}
        </div>

        {/* Grid de Produtos */}
        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-xs">
            <p className="text-slate-400 font-medium">Nenhum produto encontrado com os filtros selecionados.</p>
            <button 
              onClick={() => { setSearch(''); setSelectedSize(null); setSelectedCategory(null); }}
              className="mt-4 text-xs font-bold text-rose-500 underline"
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {produtosFiltrados.map(prod => (
              <div 
                key={prod.id} 
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 hover:border-rose-100 shadow-sm hover:shadow-lg transition-all group flex flex-col"
              >
                {/* Imagem do Produto */}
                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                  <img 
                    src={prod.imagens[0] || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600'} 
                    alt={prod.nome}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                  />
                  {prod.categoria && (
                    <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs text-rose-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                      {prod.categoria}
                    </span>
                  )}
                </div>

                {/* Conteúdo */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 leading-snug group-hover:text-rose-500 transition-colors">
                      {prod.nome}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                      {prod.descricao}
                    </p>
                  </div>

                  <div>
                    {/* Tamanhos */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prod.tamanhos.map(t => (
                        <span key={t} className="bg-slate-50 text-[10px] text-slate-500 font-bold px-2 py-0.5 rounded-md border border-slate-100">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Preço e Botão */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block leading-none">A partir de</span>
                        <span className="text-lg font-black text-slate-950">
                          R$ {prod.preco_venda.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <select 
                          id={`size-select-${prod.id}`}
                          className="bg-slate-50 text-xs font-bold border border-slate-100 rounded-lg px-2 py-1.5 focus:outline-hidden"
                        >
                          {prod.tamanhos.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => {
                            const select = document.getElementById(`size-select-${prod.id}`) as HTMLSelectElement;
                            addToCart(prod, select.value);
                          }}
                          className="bg-rose-500 text-white p-2 rounded-lg hover:bg-rose-600 transition-all font-black text-xs cursor-pointer flex items-center justify-center"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12 px-4 mt-20 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h3 className="text-rose-500 font-black text-lg">🍼 Mini Closet</h3>
            <p className="text-xs text-slate-400 mt-1">Conectando carinho e estilo na moda infantil.</p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400">
            <a href="mailto:contato@minicloset.com.br" className="hover:text-rose-500 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> E-mail
            </a>
            <a href="https://wa.me/5585994303939" target="_blank" rel="noreferrer" className="hover:text-rose-500 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp
            </a>
          </div>

          <p className="text-[10px] text-slate-400 font-medium">
            © {new Date().getFullYear()} Mini Closet • Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Sidebar do Carrinho + Checkout */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsCartOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white flex flex-col shadow-2xl animate-slide-in">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/20">
                <div className="flex items-center gap-2">
                  {cartStep === 'checkout' && (
                    <button 
                      onClick={() => setCartStep('carrinho')} 
                      className="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all cursor-pointer mr-1"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <ShoppingBag className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-slate-900">
                    {cartStep === 'carrinho' && 'Seu Carrinho'}
                    {cartStep === 'checkout' && 'Finalizar Compra'}
                    {cartStep === 'sucesso' && 'Pedido Confirmado!'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: ITENS DO CARRINHO */}
              {cartStep === 'carrinho' && (
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-4 h-full text-center py-20">
                        <ShoppingBag className="w-12 h-12 text-slate-300" />
                        <p className="text-slate-400 font-medium text-sm">Seu carrinho está vazio.</p>
                        <button 
                          onClick={() => setIsCartOpen(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Continuar comprando
                        </button>
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={`${item.produto.id}-${item.tamanho}`} className="flex items-center gap-4 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50">
                          <img 
                            src={item.produto.imagens[0]} 
                            alt={item.produto.nome}
                            className="w-16 h-16 object-cover rounded-xl bg-slate-100"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 truncate">{item.produto.nome}</h4>
                            <span className="bg-white border border-slate-200 text-[10px] text-slate-500 font-extrabold px-1.5 py-0.5 rounded-md mt-1 inline-block">
                              Tamanho: {item.tamanho}
                            </span>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-slate-400 font-bold">Qtd: {item.quantidade}</span>
                              <span className="font-black text-sm text-slate-950">R$ {(item.produto.preco_venda * item.quantidade).toFixed(2)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.produto.id, item.tamanho)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="border-t border-slate-100 p-6 flex flex-col gap-4 bg-slate-50/20">
                      <div className="border-b border-slate-100 pb-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Simular Frete e Envio</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Digite seu CEP"
                            value={cep}
                            onChange={(e) => setCep(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-rose-400"
                          />
                          <button
                            onClick={handleCalculateShipping}
                            disabled={calculatingShipping}
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {calculatingShipping ? 'Calculando...' : 'Calcular'}
                          </button>
                        </div>

                        {shippingError && <p className="text-[10px] text-rose-500 font-bold mt-1.5">{shippingError}</p>}

                        {shippingOptions.length > 0 && (
                          <div className="flex flex-col gap-2 mt-3 max-h-36 overflow-y-auto">
                            {shippingOptions.map(option => {
                              const isSelected = selectedShipping?.id === option.id;
                              return (
                                <label
                                  key={option.id}
                                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${isSelected ? 'bg-rose-50/50 border-rose-300 text-rose-700 font-bold' : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="shipping-option"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedShipping(option);
                                        if (option.id === 'retira') setTipoEntrega('retirada');
                                        else setTipoEntrega('envio');
                                      }}
                                      className="accent-rose-500"
                                    />
                                    <div>
                                      <span className="block font-semibold">{option.nome}</span>
                                      {option.prazo > 0 && <span className="text-[9px] text-slate-400 font-medium">Prazo: {option.prazo} dias úteis</span>}
                                    </div>
                                  </div>
                                  <span className="font-extrabold">{option.preco === 0 ? 'Grátis' : `R$ ${option.preco.toFixed(2)}`}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>Subtotal</span>
                          <span>R$ {cartTotal.toFixed(2)}</span>
                        </div>
                        {selectedShipping && (
                          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>Frete ({selectedShipping.nome})</span>
                            <span>{selectedShipping.preco === 0 ? 'Grátis' : `R$ ${selectedShipping.preco.toFixed(2)}`}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-100">
                          <span className="text-sm font-bold text-slate-800">Total do Pedido</span>
                          <span className="text-xl font-black text-rose-500">
                            R$ {(cartTotal + (selectedShipping ? selectedShipping.preco : 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setCartStep('checkout')}
                        className="w-full bg-rose-500 text-white py-3.5 rounded-2xl hover:bg-rose-600 transition-all font-black text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        Finalizar Pedido <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* STEP 2: CHECKOUT FORM */}
              {cartStep === 'checkout' && (
                <form onSubmit={handleCheckoutSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                  
                  {/* Dados Pessoais */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">1. Dados de Contato e Faturamento</span>
                    
                    <input 
                      type="text" 
                      required
                      placeholder="Nome Completo *"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="text" 
                        required
                        placeholder="CPF *"
                        value={clienteCpf}
                        onChange={(e) => setClienteCpf(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                      />
                      <input 
                        type="text" 
                        required
                        placeholder="WhatsApp *"
                        value={clienteWhatsapp}
                        onChange={(e) => setClienteWhatsapp(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                      />
                    </div>

                    <input 
                      type="email" 
                      placeholder="E-mail (Opcional)"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                    />
                  </div>

                  {/* Endereço de Entrega */}
                  {tipoEntrega === 'envio' && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                      <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">2. Endereço de Envio</span>
                      
                      <input 
                        type="text" 
                        required
                        placeholder="Rua / Logradouro *"
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                      />

                      <div className="grid grid-cols-3 gap-3">
                        <input 
                          type="text" 
                          required
                          placeholder="Número *"
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white col-span-1"
                        />
                        <input 
                          type="text" 
                          placeholder="Complemento"
                          value={complemento}
                          onChange={(e) => setComplemento(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white col-span-2"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text" 
                          required
                          placeholder="Bairro *"
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:bg-white"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            required
                            placeholder="Cidade *"
                            value={cidade}
                            onChange={(e) => setCidade(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-xs focus:outline-hidden focus:bg-white col-span-2"
                          />
                          <input 
                            type="text" 
                            required
                            placeholder="UF *"
                            maxLength={2}
                            value={estado}
                            onChange={(e) => setEstado(e.target.value.toUpperCase())}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-1 py-2.5 text-xs text-center focus:outline-hidden focus:bg-white col-span-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Forma de Pagamento */}
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">3. Forma de Pagamento</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormaPagamento('pix')}
                        className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${formaPagamento === 'pix' ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        <Landmark className="w-5 h-5" />
                        <span className="text-xs">Pix à Vista</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormaPagamento('cartao')}
                        className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${formaPagamento === 'cartao' ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-xs">Cartão de Crédito</span>
                      </button>
                    </div>

                    {/* Dados do Cartão se selecionado */}
                    {formaPagamento === 'cartao' && (
                      <div className="bg-slate-50 border border-slate-250 p-4 rounded-2xl flex flex-col gap-3 mt-1">
                        <input 
                          type="text" 
                          required
                          placeholder="Nome impresso no cartão *"
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                        />
                        <input 
                          type="text" 
                          required
                          placeholder="Número do Cartão *"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            required
                            placeholder="Mês (MM) *"
                            maxLength={2}
                            value={cardExpiryMonth}
                            onChange={(e) => setCardExpiryMonth(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-hidden"
                          />
                          <input 
                            type="text" 
                            required
                            placeholder="Ano (AAAA) *"
                            maxLength={4}
                            value={cardExpiryYear}
                            onChange={(e) => setCardExpiryYear(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-hidden"
                          />
                          <input 
                            type="text" 
                            required
                            placeholder="CVV *"
                            maxLength={4}
                            value={cardCcv}
                            onChange={(e) => setCardCcv(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-hidden"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-1">Parcelamento *</label>
                          <select
                            value={parcelas}
                            onChange={(e) => setParcelas(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-hidden"
                          >
                            <option value="1">1x de R$ {(cartTotal + (selectedShipping?.preco || 0)).toFixed(2)} (Sem juros)</option>
                            <option value="2">2x de R$ {((cartTotal + (selectedShipping?.preco || 0)) / 2).toFixed(2)} (Sem juros)</option>
                            <option value="3">3x de R$ {((cartTotal + (selectedShipping?.preco || 0)) / 3).toFixed(2)} (Sem juros)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {checkoutError && (
                    <p className="text-xs font-bold text-rose-500 text-center">{checkoutError}</p>
                  )}

                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-4 mt-auto">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                      <span>Total do Pedido</span>
                      <span className="text-lg font-black text-rose-500">
                        R$ {(cartTotal + (selectedShipping ? selectedShipping.preco : 0)).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={checkoutSubmitting}
                      className="w-full bg-rose-500 text-white py-3.5 rounded-2xl hover:bg-rose-600 transition-all font-black text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      {checkoutSubmitting ? 'Processando...' : 'Finalizar e Pagar'}
                    </button>
                  </div>

                </form>
              )}

              {/* STEP 3: SUCESSO DO PEDIDO */}
              {cartStep === 'sucesso' && checkoutResult && (
                <div className="flex-1 overflow-y-auto px-6 py-10 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border-2 border-emerald-200">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-none">Pedido Recebido!</h2>
                    <span className="text-xs text-rose-500 font-bold block mt-2">Número do Pedido: #{checkoutResult.codigoPedido}</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                    Parabéns! Registramos o seu pedido e estamos aguardando a compensação bancária do gateway para iniciarmos o preparo e embalagem.
                  </p>

                  {/* Detalhes do Pix se selecionado */}
                  {checkoutResult.formaPagamento === 'pix' && (
                    <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl w-full flex flex-col items-center gap-4">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pague com Pix Copia e Cola</span>
                      
                      {checkoutResult.pixQrCode && (
                        <img 
                          src={checkoutResult.pixQrCode} 
                          alt="QR Code Pix"
                          className="w-48 h-48 object-contain bg-white p-2 border border-slate-200 rounded-2xl shadow-xs" 
                        />
                      )}

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(checkoutResult.pixCopyPaste);
                          setCopiedPix(true);
                          setTimeout(() => setCopiedPix(false), 2000);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 w-full justify-center"
                      >
                        <Clipboard className="w-4 h-4" /> {copiedPix ? 'Copiado!' : 'Copiar Código Pix'}
                      </button>
                    </div>
                  )}

                  {checkoutResult.formaPagamento === 'cartao' && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-2xl w-full">
                      <span className="font-black block">Cartão Aprovado!</span>
                      Seu pagamento foi confirmado com sucesso. O status do seu pedido já está atualizado.
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setCartStep('carrinho');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer mt-4"
                  >
                    Voltar para a vitrine
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Support Button */}
      <a
        href="https://wa.me/5585994303939?text=Olá! Gostaria de tirar algumas dúvidas sobre os produtos da Mini Closet."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-[#25D366] hover:bg-[#20ba56] text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-45 group"
        title="Fale Conosco no WhatsApp"
      >
        <MessageSquare className="w-6 h-6 fill-white text-[#25D366]" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-out whitespace-nowrap text-xs font-bold uppercase tracking-wider">
          Fale Conosco
        </span>
      </a>

    </div>
  );
}
