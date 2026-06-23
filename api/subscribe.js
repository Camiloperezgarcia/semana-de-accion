export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, momento_negocio, tipo_emprendedor, horas_disponibles, cuello_botella, report } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // ── Textos legibles para campos ──
  const momentoLabel = { A: 'Empezando', B: 'Tiene claridad, falta consistencia', C: 'Vende, no escala' };
  const tipoLabel = { A: 'Mentor', B: 'Prestador de servicios', C: 'Creador de contenido' };
  const horasLabel = { A: 'Menos de 5 horas', B: 'Entre 5 y 15 horas', C: 'Más de 15 horas' };
  const cuelloLabel = { A: 'Contenido y comunidad', B: 'Producto o servicio', C: 'Ventas' };

  // ── Función para guardar en Google Sheets (sin googleapis, JWT manual) ──
  async function saveToSheets(data) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) return;

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${base64url(header)}.${base64url(payload)}`;

    const { createSign } = await import('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const { access_token } = await tokenRes.json();

    if (!access_token) return;

    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[
          fecha,
          data.name,
          data.email,
          momentoLabel[data.momento_negocio] || data.momento_negocio || '',
          tipoLabel[data.tipo_emprendedor] || data.tipo_emprendedor || '',
          horasLabel[data.horas_disponibles] || data.horas_disponibles || '',
          cuelloLabel[data.cuello_botella] || data.cuello_botella || ''
        ]]
      })
    });
  }

  try {
    // 1. Guardar en Google Sheets (sin bloquear el flujo)
    saveToSheets({ name, email, momento_negocio, tipo_emprendedor, horas_disponibles, cuello_botella })
      .catch(err => console.error('Sheets error:', err));

    // 2. Registrar en MailerLite con campos personalizados
    await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`
      },
      body: JSON.stringify({
        email: email,
        fields: {
          name: name,
          momento_negocio: momentoLabel[momento_negocio] || momento_negocio || '',
          tipo_emprendedor: tipoLabel[tipo_emprendedor] || tipo_emprendedor || '',
          horas_disponibles: horasLabel[horas_disponibles] || horas_disponibles || '',
          cuello_botella: cuelloLabel[cuello_botella] || cuello_botella || ''
        },
        groups: [process.env.MAILERLITE_GROUP_ID]
      })
    });

    // 3. Enviar email con checklist via Resend
    if (report) {
      const reportHtml = report
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/^# (.+)$/gm,'<h2 style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#1A1A2E;margin:24px 0 8px;padding:0">$1</h2>')
        .replace(/^## (.+)$/gm,'<h3 style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#C9A84C;margin:20px 0 6px;padding:0">$1</h3>')
        .replace(/^### (.+)$/gm,'<h4 style="font-size:15px;font-weight:700;color:#1A1A2E;margin:14px 0 4px;padding:0;font-family:Arial,sans-serif">$1</h4>')
        .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#1A1A2E;font-weight:700">$1</strong>')
        .replace(/\*(.+?)\*/g,'<strong style="color:#1A1A2E;font-weight:700">$1</strong>')
        .replace(/☐/g,'&#9744;')
        .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid rgba(201,168,76,0.3);margin:16px 0">')
        .replace(/Un Abrazo!\n\nCamilo Pérez\nMentor de Emprendedores en Negocios Digitales/g,'<p style="margin:32px 0 0;font-size:15px;color:#1A1A2E;font-family:Georgia,serif;line-height:1.8">Un Abrazo!<br><br><strong style="font-size:16px">Camilo Pérez</strong><br><span style="font-size:13px;color:#888">Mentor de Emprendedores en Negocios Digitales</span></p>')
        .replace(/\n\n/g,'</p><p style="margin:0 0 12px;line-height:1.8;color:#2A2A3E;font-family:Georgia,serif">')
        .replace(/\n/g,'<br>');

      const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#FFFFFF;padding:40px 40px 28px;border-radius:12px 12px 0 0;border-top:3px solid #C9A84C">
    <p style="margin:0 0 16px;font-size:16px;color:#1A1A2E;line-height:1.7;font-family:Georgia,serif">Hola <strong>${name}</strong>,</p>
    <p style="margin:0 0 14px;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif">Aquí está tu checklist personalizado de la semana. Lo armamos según tu momento, tu tipo de negocio y las horas que tienes disponibles.</p>
    <p style="margin:0;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif"><strong style="color:#1A1A2E">No lo guardes para después. Ábrelo, léelo y arranca con la primera tarea hoy.</strong></p>
  </td></tr>

  <!-- BADGE -->
  <tr><td style="background:#1A1A2E;padding:22px 40px">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif">TU SEMANA DE ACCIÓN</p>
    <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif">Checklist personalizado para ${name}</p>
  </td></tr>

  <!-- CHECKLIST -->
  <tr><td style="background:#FFFFFF;padding:32px 40px">
    <p style="margin:0 0 12px;line-height:1.8;color:#2A2A3E;font-family:Georgia,serif">${reportHtml}</p>
  </td></tr>

  <!-- CTA FINAL -->
  <tr><td style="background:#1A1A2E;padding:28px 40px">
    <p style="margin:0 0 16px;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif">¿Quieres construir un negocio digital con estructura real, no con improvisación?</p>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif;font-style:italic">¿Cómo te fue con tu checklist? <strong style="color:#FFFFFF;font-style:normal">Responde este correo y cuéntame. Lo leo personalmente.</strong></p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1A1A2E;padding:20px 40px;border-radius:0 0 12px 12px;border-top:1px solid rgba(255,255,255,0.08)">
    <p style="margin:0;font-size:12px;color:rgba(245,240,232,0.35);text-align:center;font-family:Arial,sans-serif">© Camilo Pérez García · @camiloperezgarcia · camilo@miimperiodigital.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Camilo Pérez García <camilo@miimperiodigital.com>',
          to: [email],
          subject: `${name}, tu semana de acción está aquí ✦`,
          html: emailHtml
        })
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Error' });
  }
}
