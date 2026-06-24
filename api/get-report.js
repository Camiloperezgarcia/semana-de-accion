export const maxDuration = 15;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing report ID' });
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceAccountEmail || !privateKey || !sheetId) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // ── Generar JWT ──
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
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

    // ── Obtener access token ──
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const { access_token } = await tokenRes.json();

    if (!access_token) {
      return res.status(500).json({ error: 'Auth failed' });
    }

    // ── Leer datos de Google Sheets ──
    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:I`,
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    );
    const sheetsData = await sheetsRes.json();
    const rows = sheetsData.values || [];

    // Buscar fila con el ID (columna H = índice 7)
    const match = rows.find(row => row[7] === id);

    if (!match) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.status(200).json({
      name: match[1] || '',
      report: match[8] || '',
      momento: match[3] || '',
      tipo: match[4] || '',
      horas: match[5] || '',
      cuello: match[6] || ''
    });

  } catch (err) {
    console.error('Get report error:', err);
    return res.status(500).json({ error: 'Error retrieving report' });
  }
}
