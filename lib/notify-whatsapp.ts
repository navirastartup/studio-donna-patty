export async function sendWhatsAppConfirmation(
    phone: string,
    name: string,
    date: string,
    time: string,
    service: string
  ) {
    try {
      // Normalizar número
      let formatted = phone.replace(/\D/g, ""); // remove tudo que não é número
  
      // Remove DDI duplicado
      if (formatted.startsWith("55")) {
        formatted = formatted.slice(2);
      }
  
      const fullPhone = `+55${formatted}`; // Formato final garantido
  
      const message = `✅ Olá ${name}! Seu agendamento para *${service}* foi confirmado.
  📅 Data: ${date}
  ⏰ Horário: ${time}
  Nos vemos em breve!`;
  
      const payload = {
        messaging_product: "whatsapp",
        to: fullPhone,
        type: "text",
        text: { body: message }
      };
  
      const res = await fetch(
        `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
  
      const json = await res.json();
      console.log("📨 WhatsApp enviado:", json);
    } catch (err) {
      console.error("❌ Erro ao enviar WhatsApp:", err);
    }
  }
  