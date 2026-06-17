import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { sendOrderEmail } from '../../../../lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook Asaas recebido:', JSON.stringify(body, null, 2));

    const { event, payment } = body;

    if (!event || !payment) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const paymentId = payment.id;
    const orderId = payment.externalReference;
    const value = payment.value;
    const netValue = payment.netValue;
    const status = payment.status;

    // Calcular a taxa real cobrada pelo gateway
    let taxaCobrada = 0;
    if (value && netValue) {
      taxaCobrada = Number((value - netValue).toFixed(2));
    }

    // Se o pagamento foi recebido ou confirmado
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || status === 'RECEIVED' || status === 'CONFIRMED') {
      console.log(`Pagamento confirmado para o pedido ${orderId || 'desconhecido'} (Asaas ID: ${paymentId})`);

      // Buscar o pedido por ID (externalReference) ou asaas_payment_id
      let query = supabase.from('pedidos').update({
        status: 'pago',
        taxa_gateway_paga: taxaCobrada
      });

      if (orderId) {
        query = query.eq('id', orderId);
      } else {
        query = query.eq('asaas_payment_id', paymentId);
      }

      const { data, error } = await query.select();

      if (error) {
        console.error('Erro ao atualizar status do pedido no Supabase:', error);
        return NextResponse.json({ error: 'Erro ao atualizar pedido' }, { status: 500 });
      }

      console.log('Pedido atualizado com sucesso:', data);

      // Enviar e-mail de confirmação de pagamento
      if (data && data.length > 0) {
        const order = data[0];
        if (order.cliente_email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const trackingLink = `${appUrl}/pedido/${order.id}`;
          const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #ec4899; text-align: center;">🍼 Mini Closet</h2>
              <p>Olá, <strong>${order.cliente_nome}</strong>!</p>
              <p>Seu pagamento foi <strong>confirmado com sucesso</strong>! 🎉</p>
              <p>Nossa equipe já está separando o seu pedido para preparar o envio ou retirada.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <h3 style="color: #333;">Detalhes do Pedido #${order.codigo_pedido.toString().padStart(5, '0')}</h3>
              <p><strong>Total Pago:</strong> R$ ${Number(order.total_pedido).toFixed(2)}</p>
              <p><strong>Tipo de Entrega:</strong> ${order.tipo_entrega === 'envio' ? 'Envio via Transportadora' : 'Retirada em Mãos'}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <div style="text-align: center; margin: 30px 0;">
                <a href="${trackingLink}" style="background-color: #10b981; color: white; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Acompanhar Meu Pedido</a>
              </div>
              <p style="font-size: 12px; color: #777; text-align: center;">Se você tiver alguma dúvida, entre em contato pelo nosso WhatsApp ou e-mail.</p>
            </div>
          `;
          sendOrderEmail(order.cliente_email, `Pagamento Confirmado! Pedido #${order.codigo_pedido.toString().padStart(5, '0')} - Mini Closet`, emailHtml).catch(console.error);
        }
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      console.log(`Pagamento vencido para o pedido ${orderId || 'desconhecido'} (Asaas ID: ${paymentId})`);
      
      let query = supabase.from('pedidos').update({
        status: 'cancelado'
      });

      if (orderId) {
        query = query.eq('id', orderId);
      } else {
        query = query.eq('asaas_payment_id', paymentId);
      }

      await query;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro no processamento do webhook Asaas:', error);
    return NextResponse.json({ error: 'Erro interno no processamento do webhook' }, { status: 500 });
  }
}
