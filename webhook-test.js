// Teste do webhook - simulando webhook do Stripe
const webhookTest = async () => {
  try {
    const response = await fetch('https://lwwelsxmkaomnbiykqpt.supabase.co/functions/v1/send-n8n-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3d2Vsc3hta2FvbW5iaXlrcXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0OTQ2OTIsImV4cCI6MjA2NzA3MDY5Mn0.ZuwWsSzalqKOAs0MfiLm-GraJAjeYv1QFheRire5Q48',
      },
      body: JSON.stringify({ 
        orderNumber: 'ORD-2025-001' 
      })
    });

    const result = await response.json();
    console.log('Webhook response:', result);
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
  }
};

// Executar teste
webhookTest();