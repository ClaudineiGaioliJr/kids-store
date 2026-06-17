import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendOrderEmail } from '../../../lib/email';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const IS_SANDBOX = process.env.ASAAS_SANDBOX !== 'false';

const ASAAS_URL = IS_SANDBOX 
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      clienteNome, 
      clienteCpf, 
      clienteWhatsapp, 
      clienteEmail, 
      tipoEntrega, 
      selectedShipping, 
      endereco,
      formaPagamento,
      parcelas,
      cart,
      // Se for cartão, recebemos os dados dele (nunca persistir no BD local por conformidade PCI)
      cartaoDados
    } = body;

    // 1. Validações Básicas
    if (!clienteNome || !clienteCpf || !clienteWhatsapp || !cart || cart.length === 0) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    // Calcular totais
    const totalProdutos = cart.reduce((acc: number, item: any) => acc + (item.produto.preco_venda * item.quantidade), 0);
    const freteValor = tipoEntrega === 'envio' && selectedShipping ? Number(selectedShipping.preco) : 0.00;
    const totalPedido = totalProdutos + freteValor;

    // 2. Criar registro do Pedido no Supabase
    const { data: orderData, error: orderError } = await supabase
      .from('pedidos')
      .insert([
        {
          cliente_nome: clienteNome,
          cliente_cpf: clienteCpf,
          cliente_whatsapp: clienteWhatsapp,
          cliente_email: clienteEmail || null,
          tipo_entrega: tipoEntrega,
          frete_valor: freteValor,
          frete_prazo: tipoEntrega === 'envio' && selectedShipping ? selectedShipping.prazo.toString() : null,
          endereco_cep: endereco?.cep || null,
          endereco_rua: endereco?.rua || null,
          numero: endereco?.numero || null,
          complemento: endereco?.complemento || null,
          bairro: endereco?.bairro || null,
          cidade: endereco?.cidade || null,
          estado: endereco?.estado || null,
          total_produtos: totalProdutos,
          total_pedido: totalPedido,
          status: 'aguardando_pagamento',
          forma_pagamento: formaPagamento,
          parcelas: formaPagamento === 'cartao' ? Number(parcelas || 1) : 1
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error('Erro ao criar pedido no BD:', orderError);
      return NextResponse.json({ error: 'Erro ao registrar o pedido' }, { status: 500 });
    }

    const pedidoId = orderData.id;
    const codigoPedido = orderData.codigo_pedido;

    // 3. Criar os itens do pedido no Supabase
    const itemsPayload = cart.map((item: any) => ({
      pedido_id: pedidoId,
      produto_id: item.produto.id.startsWith('m') ? null : item.produto.id, // Se for mock, desvincular FK
      quantidade: item.quantidade,
      tamanho_selecionado: item.tamanho,
      preco_venda_unitario: Number(item.produto.preco_venda),
      preco_custo_unitario: Number(item.produto.preco_custo)
    }));

    const { error: itemsError } = await supabase
      .from('itens_pedido')
      .insert(itemsPayload);

    if (itemsError) {
      console.error('Erro ao criar itens no BD:', itemsError);
      // Apagar o pedido criado para evitar inconsistência
      await supabase.from('pedidos').delete().eq('id', pedidoId);
      return NextResponse.json({ error: 'Erro ao registrar itens do pedido' }, { status: 500 });
    }

    // 4. Integração Asaas (ou Mock se sem chave API)
    if (!ASAAS_API_KEY) {
      console.log('ASAAS_API_KEY não configurada. Ganhando Pix mockado para testes.');
      
      const payloadMock: any = {
        success: true,
        pedidoId,
        codigoPedido,
        formaPagamento,
        totalPedido
      };

      if (formaPagamento === 'pix') {
        payloadMock.pixCopyPaste = '00020101021226870014br.gov.bcb.pix25650021miniclosetfakekeypix123520400005303986540579.905802BR5911Mini Closet6009Sao Paulo62070503***6304ABCD';
        payloadMock.pixQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(payloadMock.pixCopyPaste);
      }

      await enviarEmailConfirmacaoPedido(clienteEmail, clienteNome, totalPedido, formaPagamento, tipoEntrega, codigoPedido, pedidoId);

      return NextResponse.json(payloadMock);
    }

    // Executar chamada real ao Asaas
    try {
      // A. Criar / Obter Cliente no Asaas
      const customerId = await obterOuCriarClienteAsaas(clienteNome, clienteCpf, clienteEmail, clienteWhatsapp);

      // B. Criar Cobrança no Asaas
      let asaasPaymentId = '';
      let pixDetails: any = null;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Vencimento em 1 dia
      const dueDateFormatted = dueDate.toISOString().split('T')[0];

      const paymentBody: any = {
        customer: customerId,
        billingType: formaPagamento === 'pix' ? 'PIX' : 'CREDIT_CARD',
        value: totalPedido,
        dueDate: dueDateFormatted,
        externalReference: pedidoId,
        description: `Pedido #${codigoPedido} na loja Mini Closet`
      };

      if (formaPagamento === 'cartao') {
        paymentBody.creditCard = {
          holderName: cartaoDados.holderName,
          number: cartaoDados.number,
          expiryMonth: cartaoDados.expiryMonth,
          expiryYear: cartaoDados.expiryYear,
          ccv: cartaoDados.ccv
        };
        paymentBody.creditCardHolderInfo = {
          name: clienteNome,
          email: clienteEmail || 'contato@minicloset.com.br',
          cpfCnpj: clienteCpf,
          postalCode: endereco?.cep || '01001000',
          addressNumber: endereco?.numero || 'S/N',
          phone: clienteWhatsapp
        };
        paymentBody.installmentCount = Number(parcelas || 1);
      }

      const paymentRes = await fetch(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify(paymentBody)
      });

      const paymentData = await paymentRes.json();

      if (!paymentRes.ok) {
        console.error('Erro Asaas Payment:', paymentData);
        throw new Error(paymentData.errors?.[0]?.description || 'Erro na transação de pagamento no Asaas');
      }

      asaasPaymentId = paymentData.id;

      // C. Se for Pix, obter o QR Code
      if (formaPagamento === 'pix') {
        const pixRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/pixQrCode`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'access_token': ASAAS_API_KEY
          }
        });
        
        if (pixRes.ok) {
          const pixData = await pixRes.json();
          pixDetails = {
            pixCopyPaste: pixData.payload,
            pixQrCode: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixData.payload)}`
          };
        }
      }

      // D. Atualizar pedido no Supabase com o ID do pagamento e taxa estimada
      const taxaEstimada = formaPagamento === 'pix' ? 0.99 : (totalPedido * 0.0299) + 0.40;
      await supabase
        .from('pedidos')
        .update({ 
          asaas_payment_id: asaasPaymentId,
          taxa_gateway_paga: taxaEstimada,
          status: formaPagamento === 'cartao' && paymentData.status === 'CONFIRMED' ? 'pago' : 'aguardando_pagamento'
        })
        .eq('id', pedidoId);

      await enviarEmailConfirmacaoPedido(clienteEmail, clienteNome, totalPedido, formaPagamento, tipoEntrega, codigoPedido, pedidoId);

      return NextResponse.json({
        success: true,
        pedidoId,
        codigoPedido,
        formaPagamento,
        totalPedido,
        ...pixDetails,
        cardConfirmed: formaPagamento === 'cartao' && paymentData.status === 'CONFIRMED'
      });

    } catch (err: any) {
      console.error('Erro na integração Asaas:', err);
      // Rollback do pedido
      await supabase.from('pedidos').delete().eq('id', pedidoId);
      return NextResponse.json({ error: err.message || 'Falha no gateway de pagamentos' }, { status: 500 });
    }

  } catch (err: any) {
    console.error('Erro na rota /api/checkout:', err);
    return NextResponse.json({ error: 'Erro interno no checkout' }, { status: 500 });
  }
}

// Helper: Obter ou Criar Cliente no Asaas
async function obterOuCriarClienteAsaas(nome: string, cpf: string, email: string, whatsapp: string): Promise<string> {
  const cleanCpf = cpf.replace(/\D/g, '');

  // 1. Verificar se cliente existe
  const listRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'access_token': ASAAS_API_KEY
    }
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.data && listData.data.length > 0) {
      return listData.data[0].id;
    }
  }

  // 2. Se não existir, criar novo
  const createRes = await fetch(`${ASAAS_URL}/customers`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    },
    body: JSON.stringify({
      name: nome,
      cpfCnpj: cleanCpf,
      email: email || undefined,
      mobilePhone: whatsapp.replace(/\D/g, '') || undefined
    })
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas');
  }

  return createData.id;
}

async function enviarEmailConfirmacaoPedido(
  email: string | null,
  nome: string,
  total: number,
  formaPagamento: string,
  tipoEntrega: string,
  codigoPedido: number,
  pedidoId: string
) {
  if (!email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const trackingLink = `${appUrl}/pedido/${pedidoId}`;
  
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #ec4899; text-align: center;">🍼 Mini Closet</h2>
      <p>Olá, <strong>${nome}</strong>!</p>
      <p>Recebemos o seu pedido com sucesso. Estamos aguardando a confirmação do pagamento para iniciar os preparativos de envio.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <h3 style="color: #333;">Resumo do Pedido #${codigoPedido.toString().padStart(5, '0')}</h3>
      <p><strong>Total:</strong> R$ ${total.toFixed(2)}</p>
      <p><strong>Forma de Pagamento:</strong> ${formaPagamento.toUpperCase()}</p>
      <p><strong>Tipo de Entrega:</strong> ${tipoEntrega === 'envio' ? 'Envio via Transportadora' : 'Retirada em Mãos'}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <div style="text-align: center; margin: 30px 0;">
        <a href="${trackingLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Acompanhar Status do Pedido</a>
      </div>
      <p style="font-size: 12px; color: #777; text-align: center;">Se você tiver alguma dúvida, entre em contato pelo nosso WhatsApp ou e-mail.</p>
    </div>
  `;

  try {
    await sendOrderEmail(email, `Pedido Recebido #${codigoPedido.toString().padStart(5, '0')} - Mini Closet`, emailHtml);
  } catch (error) {
    console.error('Erro ao disparar e-mail de recebimento:', error);
  }
}
