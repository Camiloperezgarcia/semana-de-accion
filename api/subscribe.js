export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, patron, patronSecundario, perfil, report } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const VIDEO_URL = process.env.VIDEO_URL || 'https://identidad.miimperiodigital.com/video';
  const VIDEO_THUMBNAIL = `https://img.youtube.com/vi/luuMsBECyL8/maxresdefault.jpg`;

  // Función para guardar en Google Sheets
  async function saveToSheets(data) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) return;

    // Generar JWT para autenticación
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

    // Importar crypto para firmar
    const { createSign } = await import('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    // Obtener access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const { access_token } = await tokenRes.json();

    if (!access_token) return;

    // Mapear perfil al nombre visible
    const perfilNombres = {
      mentor: 'Mentor',
      prestador: 'Prestador de Servicios',
      creador: 'Infoproductor',
      explorando: 'Sin Definir'
    };
    const perfilVisible = perfilNombres[data.perfil] || data.perfil || 'Sin Definir';

    // Agregar fila a Google Sheets
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[fecha, data.name, data.email, perfilVisible, data.patron, data.patronSecundario || '']]
      })
    });
  }

  try {
    // 1. Guardar en Google Sheets (sin bloquear el flujo)
    saveToSheets({ name, email, perfil, patron, patronSecundario }).catch(err => console.error('Sheets error:', err));

    // 2. Registrar en MailerLite con perfil y patrón secundario
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
          patron_identidad: patron,
          patron_secundario: patronSecundario || '',
          perfil_negocio: perfil || ''
        },
        groups: [process.env.MAILERLITE_GROUP_ID]
      })
    });

    // 2. Enviar email transaccional via Resend
    if (report) {
      const reportHtml = report
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/^## TU PATRÓN SECUNDARIO: (.+)$/gm,
          '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#1A1A2E;padding:16px 24px;border-radius:8px"><p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.15em;text-transform:uppercase;font-family:Arial,sans-serif">TU PATRÓN SECUNDARIO</p><p style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif">$1</p></td></tr></table>')
        .replace(/^# (.+)$/gm,'<h2 style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1A1A2E;margin:24px 0 8px;padding:0">$1</h2>')
        .replace(/^## (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#C9A84C;margin:20px 0 6px;padding:0">$1</h3>')
        .replace(/^### (.+)$/gm,'<h4 style="font-size:15px;font-weight:700;color:#1A1A2E;margin:14px 0 4px;padding:0;font-family:Arial,sans-serif">$1</h4>')
        .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#1A1A2E;font-weight:700">$1</strong>')
        .replace(/\*(.+?)\*/g,'<strong style="color:#1A1A2E;font-weight:700">$1</strong>')
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

  <!-- BIENVENIDA -->
  <tr><td style="background:#FFFFFF;padding:40px 40px 28px;border-radius:12px 12px 0 0;border-top:3px solid #C9A84C">
    <p style="margin:0 0 16px;font-size:16px;color:#1A1A2E;line-height:1.7;font-family:Georgia,serif">Hola <strong>${name}</strong>,</p>
    <p style="margin:0 0 14px;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif">Completaste tu diagnóstico de identidad. Lo que acabas de descubrir no es un defecto — es el punto de partida más honesto que puedes tener como emprendedor.</p>
    <p style="margin:0 0 14px;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif">Antes de leer tu reporte, te pido que veas el video que está justo abajo. En él explico qué significa cada patrón de identidad, desde dónde nace y por qué reconocerlo cambia todo. Con ese contexto, tu reporte va a tener mucho más sentido.</p>
    <p style="margin:0;font-size:15px;color:#2A2A3E;line-height:1.8;font-family:Georgia,serif"><strong style="color:#1A1A2E">Tómate 8 minutos para verlo antes de seguir.</strong> Vale la pena.</p>
  </td></tr>

  <!-- VIDEO -->
  <tr><td style="background:#FFFFFF;padding:0 40px 36px;text-align:center">
    <a href="${VIDEO_URL}" style="display:block;text-decoration:none">
      <div style="border-radius:10px;overflow:hidden;border:2px solid rgba(201,168,76,0.4)">
        <div style="overflow:hidden;border-radius:8px;max-height:293px"><img src="${VIDEO_THUMBNAIL}" alt="Las Identidades del Emprendedor" width="520" style="width:100%;max-width:520px;display:block;margin-top:-10%;margin-bottom:-10%"></div>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#C9A84C;font-weight:700;letter-spacing:0.04em;font-family:Arial,sans-serif">▶ Ver video — Las Identidades del Emprendedor</p>
    </a>
  </td></tr>

  <!-- SEPARADOR -->
  <tr><td style="background:#F5F0E8;padding:24px 40px;text-align:center">
    <p style="margin:0;font-size:17px;color:#1A1A2E;font-style:italic;font-family:Georgia,serif;font-weight:700">¿Ya lo viste? Ahora sí — aquí está tu reporte.</p>
  </td></tr>

  <!-- PATRÓN PREDOMINANTE BADGE -->
  <tr><td style="background:#1A1A2E;padding:22px 40px">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif">TU PATRÓN PREDOMINANTE</p>
    <p style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif">${patron}</p>
  </td></tr>

  <!-- REPORTE -->
  <tr><td style="background:#FFFFFF;padding:32px 40px">
    <p style="margin:0 0 12px;line-height:1.8;color:#2A2A3E;font-family:Georgia,serif">${reportHtml}</p>
  </td></tr>

  <!-- CTA FINAL -->
  <tr><td style="background:#1A1A2E;padding:28px 40px">
    <p style="margin:0 0 16px;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif">¿Quieres ir más profundo? El trabajo de resignificar tu patrón de identidad es exactamente lo que hacemos en mi Mentoría para Emprendedores Digitales.</p>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(245,240,232,0.85);line-height:1.7;font-family:Georgia,serif;font-style:italic">¿Qué te llevás de este diagnóstico? <strong style="color:#FFFFFF;font-style:normal">Responde este correo con lo primero que se te venga a la mente. Lo leo personalmente.</strong></p>
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
          subject: `${name}, tu diagnóstico de identidad está aquí`,
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
