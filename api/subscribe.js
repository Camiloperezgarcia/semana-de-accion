export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, momento_negocio, tipo_emprendedor, horas_disponibles, cuello_botella, report } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // ── Generar ID único para el reporte ──
  const reportId = 'sa_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  const reportUrl = `https://accion.miimperiodigital.com?id=${reportId}`;

  // ── Textos legibles para campos ──
  const momentoLabel = { A: 'Empezando', B: 'Tiene claridad, falta consistencia', C: 'Vende, no escala' };
  const tipoLabel = { A: 'Mentor', B: 'Prestador de servicios', C: 'Creador de contenido' };
  const horasLabel = { A: 'Menos de 5 horas', B: 'Entre 5 y 15 horas', C: 'Más de 15 horas' };
  const cuelloLabel = { A: 'Contenido y comunidad', B: 'Producto o servicio', C: 'Ventas' };

  // ── Función para guardar en Google Sheets (con ID y reporte completo) ──
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
          cuelloLabel[data.cuello_botella] || data.cuello_botella || '',
          data.reportId,
          data.report
        ]]
      })
    });
  }

  try {
    // 1. Guardar en Google Sheets (sin bloquear el flujo)
    saveToSheets({ name, email, momento_negocio, tipo_emprendedor, horas_disponibles, cuello_botella, reportId, report: report || '' })
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

    // 3. Enviar email con LINK al reporte (no el reporte completo)
    if (report) {
      const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#FFFFFF;padding:40px 40px 32px;border-radius:12px 12px 0 0;border-top:3px solid #C9A84C">
    <p style="margin:0 0 20px;font-size:16px;color:#1A1A2E;line-height:1.7;font-family:Georgia,serif">Hola <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif">Tu checklist personalizado de la semana está listo. Lo creamos según tu momento, tu tipo de negocio y las horas que tienes disponibles.</p>
    <p style="margin:0 0 24px;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif"><strong style="color:#1A1A2E">Adentro vas a encontrar:</strong></p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td style="padding:12px 16px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:8px">
        <p style="margin:0 0 8px;font-size:14px;color:#1A1A2E;font-family:Arial,sans-serif"><strong>🎯 Tu prioridad #1</strong> de la semana</p>
        <p style="margin:0 0 8px;font-size:14px;color:#1A1A2E;font-family:Arial,sans-serif"><strong>☑️ Checklist interactivo</strong> con tareas que puedes ir marcando</p>
        <p style="margin:0;font-size:14px;color:#1A1A2E;font-family:Arial,sans-serif"><strong>⚡ Tu acción #1</strong> para empezar hoy mismo</p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${reportUrl}" target="_blank" style="display:inline-block;background:#C9A84C;color:#1A1A2E;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.02em">Ver mi checklist interactivo →</a>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:rgba(26,26,46,0.4);text-align:center;font-family:Arial,sans-serif">Puedes volver a abrirlo cuando quieras desde este link.</p>
  </td></tr>

  <!-- CTA FINAL -->
  <tr><td style="background:#1A1A2E;padding:28px 40px">
    <p style="margin:0 0 16px;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif">¿Quieres construir un negocio digital con estructura real, no con improvisación?</p>
    <p style="margin:0;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif;font-style:italic">¿Cómo te fue con tu checklist? <strong style="color:#FFFFFF;font-style:normal">Responde este correo y cuéntame. Lo leo personalmente.</strong></p>
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
          subject: `${name}, tu semana de acción está lista ✦`,
          html: emailHtml
        })
      });
    }

    return res.status(200).json({ success: true, reportId });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Error' });
  }
}
