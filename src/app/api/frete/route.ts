import { NextResponse } from 'next/server';

// CEP de Origem padrão da loja (pode ser configurado no .env.local)
const ORIGIN_CEP = process.env.STORE_ORIGIN_CEP || '01001000'; 
const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || '';
const IS_SANDBOX = process.env.MELHOR_ENVIO_SANDBOX !== 'false'; // Padrão: sandbox para segurança

const MELHOR_ENVIO_URL = IS_SANDBOX 
  ? 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
  : 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';

interface ProductItem {
  id: string;
  weight: number;      // em kg
  width: number;       // em cm
  height: number;      // em cm
  length: number;      // em cm
  insurance_value: number; // valor declarado
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const { cepDestino, itens } = await request.json();

    if (!cepDestino) {
      return NextResponse.json({ error: 'CEP de destino obrigatório' }, { status: 400 });
    }

    if (!itens || itens.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    // Normalizar CEP (remover hifens, espaços)
    const cleanDestinationCep = cepDestino.replace(/\D/g, '');
    const cleanOriginCep = ORIGIN_CEP.replace(/\D/g, '');

    if (cleanDestinationCep.length !== 8) {
      return NextResponse.json({ error: 'CEP de destino inválido' }, { status: 400 });
    }

    // Se não houver token do Melhor Envio configurado, responder com Mock Inteligente para testes
    if (!MELHOR_ENVIO_TOKEN) {
      console.log('MELHOR_ENVIO_TOKEN não configurado. Utilizando simulação local (Mock).');
      return NextResponse.json(obterMockFrete(cleanDestinationCep, itens));
    }

    // Formatar itens do carrinho para a estrutura exigida pelo Melhor Envio
    const productsPayload = itens.map((item: any) => ({
      id: item.produto.id,
      weight: Math.max(0.1, (item.produto.peso_g || 200) / 1000), // convert g -> kg, min 100g
      width: Math.max(10, item.produto.largura_cm || 15),
      height: Math.max(4, item.produto.altura_cm || 5),
      length: Math.max(15, item.produto.comprimento_cm || 20),
      insurance_value: Number(item.produto.preco_venda),
      quantity: Number(item.quantidade)
    }));

    const body = {
      from: { postal_code: cleanOriginCep },
      to: { postal_code: cleanDestinationCep },
      products: productsPayload
    };

    const response = await fetch(MELHOR_ENVIO_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'User-Agent': 'kids-store (contato@seusite.com.br)'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Melhor Envio API:', errorText);
      return NextResponse.json({ error: 'Erro ao calcular frete no parceiro logístico' }, { status: 500 });
    }

    const data = await response.json();
    
    // Filtrar e formatar apenas as opções que deram certo e que nos interessam (ex: Correios PAC/SEDEX, Jadlog)
    // A API do Melhor Envio retorna um array de objetos de serviços de frete
    const formattedServices = data
      .filter((s: any) => !s.error) // remove serviços com erro
      .map((s: any) => ({
        id: s.id, // ID do serviço no Melhor Envio (ex: 1 = PAC, 2 = SEDEX)
        nome: `${s.company.name} ${s.name}`, // Ex: "Correios SEDEX"
        preco: Number(s.price),
        prazo: Number(s.delivery_time), // dias úteis
        logo: s.company.picture
      }));

    return NextResponse.json(formattedServices);
  } catch (err: any) {
    console.error('Erro interno na rota /api/frete:', err);
    return NextResponse.json({ error: 'Erro interno no cálculo do frete' }, { status: 500 });
  }
}

// Gera simulação inteligente baseada na distância relativa do CEP
function obterMockFrete(cepDestino: string, itens: any[]) {
  // Cálculo de valor base das roupas
  const totalProdutos = itens.reduce((acc, item) => acc + (item.produto.preco_venda * item.quantidade), 0);
  
  // Regra de Frete Grátis acima de R$ 250
  const isFreteGratis = totalProdutos >= 250;

  // Usa os primeiros dígitos do CEP para simular distâncias (SP, RJ, Nordeste, Sul)
  const regiao = parseInt(cepDestino.substring(0, 2));
  
  let multiplicador = 1.0;
  let diasBase = 3;

  if (regiao >= 1 && regiao <= 19) {
    // São Paulo (próximo)
    multiplicador = 0.8;
    diasBase = 2;
  } else if (regiao >= 20 && regiao <= 39) {
    // RJ, MG, ES
    multiplicador = 1.2;
    diasBase = 4;
  } else if (regiao >= 40 && regiao <= 69) {
    // Nordeste e Centro-Oeste
    multiplicador = 1.8;
    diasBase = 6;
  } else {
    // Norte e Sul distante
    multiplicador = 2.2;
    diasBase = 8;
  }

  // Peso total estimado do carrinho
  const pesoTotalG = itens.reduce((acc, item) => acc + ((item.produto.peso_g || 200) * item.quantidade), 0);
  const pesoFator = Math.max(1, pesoTotalG / 1000); // 1kg base

  return [
    {
      id: 1,
      nome: 'Correios PAC',
      preco: isFreteGratis ? 0.00 : Number((18.50 * multiplicador * pesoFator).toFixed(2)),
      prazo: diasBase + 3,
      logo: ''
    },
    {
      id: 2,
      nome: 'Correios SEDEX',
      preco: isFreteGratis ? 12.00 : Number((29.90 * multiplicador * pesoFator).toFixed(2)), // Sedex ganha desconto se fosse grátis
      prazo: diasBase,
      logo: ''
    },
    {
      id: 3,
      nome: 'Jadlog Express',
      preco: isFreteGratis ? 0.00 : Number((22.00 * multiplicador * pesoFator).toFixed(2)),
      prazo: diasBase + 1,
      logo: ''
    }
  ];
}
