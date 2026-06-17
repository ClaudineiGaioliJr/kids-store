const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

export async function sendOrderEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log('--- MOCK EMAIL ---');
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(`Conteúdo:\n${html.replace(/<[^>]*>/g, ' ')}`);
    console.log('------------------');
    return { success: true, mock: true };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao enviar e-mail via Resend:', data);
      return { success: false, error: data };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Erro de conexão ao enviar e-mail:', error);
    return { success: false, error };
  }
}
