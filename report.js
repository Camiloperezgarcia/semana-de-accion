export const maxDuration = 30;
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, primary, secondary, perfil, primerPaso } = req.body;

  if (!name || !primary) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const patternNames = {
    demostrador:   'El Demostrador',
    fugitivo:      'El Fugitivo',
    urgente:       'El Urgente',
    buscador:      'El Buscador de Reconocimiento',
    perfeccionista:'El Perfeccionista Paralizado',
    seguidor:      'El Seguidor de Tendencias',
    salvador:      'El Salvador',
    impostor:      'El Impostor Silencioso'
  };

  const primName = patternNames[primary] || primary;
  const secName  = secondary ? patternNames[secondary] : null;

  const primerPasoTexto = primerPaso || 'Dedica 30 minutos esta semana a escribir con honestidad desde qué motivación real estás construyendo tu negocio. No la versión pública — la versión verdadera. Ese ejercicio es el inicio del trabajo de resignificación.';

  const prompt = `Eres Camilo Pérez García, mentor de emprendedores en negocios digitales con sede en Cali, Colombia. Tu tono es cercano, honesto, directo pero humano — como hablarle a un estudiante de confianza. Sin corporativo, sin hype, sin promesas vacías.

Genera un reporte personalizado de diagnóstico de identidad para ${name}.

PATRÓN PREDOMINANTE: ${primName}
${secName ? `PATRÓN SECUNDARIO: ${secName}` : 'Sin patrón secundario significativo'}

El reporte debe tener entre 400 y 500 palabras. Usa exactamente esta estructura con estos títulos en markdown:

1. Saludo breve y personalizado a ${name} (1-2 líneas, sin título)

2. ## ${primName}
   Descripción del patrón — en qué consiste, desde dónde nace (2-3 párrafos)

3. ## Cómo se ve en tu Emprendimiento
   Cómo este patrón se manifiesta concretamente — consecuencias reales y visibles (1-2 párrafos)

4. ${secName ? `## TU PATRÓN SECUNDARIO: ${secName}\nCómo refuerza al predominante (1 párrafo)` : '## Una nota importante\nUna nota sobre que la mayoría tiene un patrón predominante claro como este (1 párrafo)'}

5. ## 🔍 Lo que necesitas resignificar
   El área de trabajo concreto para este patrón (1 párrafo)

6. ## 🗓️ Tu primer paso esta semana
   Usa exactamente este texto para el primer paso (no lo cambies, no lo resumas):
   ${primerPasoTexto}

IMPORTANTE:
- Habla en segunda persona (tú)
- Usa lenguaje neutro e inclusivo en todo momento: evita términos que asuman género. En lugar de "preparado/a" usa "en condiciones de", en lugar de "listo/a" usa "en el momento indicado", en lugar de "experto/a" usa "referente" o "profesional", en lugar de "cansado/a" usa "agotada la paciencia". Si necesitas adjetivar, usa formas neutras o reescribe la frase para evitar la marca de género.
- Tono: cercano, sin juzgar, desde la experiencia, como alguien que ya recorrió este camino
- NO incluyas el CTA al programa, eso está en otro lugar
- Cuando uses palabras entre asteriscos simples como *palabra*, escríbelas entre doble asterisco **palabra** para que queden en negrilla
- Evita usar guiones largos (—) en el texto; usa comas o punto y coma para separar ideas
- Al final del reporte, después del primer paso, agrega exactamente este bloque de firma con los saltos de línea:

Un Abrazo!

Camilo Pérez
Mentor de Emprendedores en Negocios Digitales`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicRes.json();
    const reportText = data.content?.[0]?.text;

    if (!reportText) {
      throw new Error('No report text returned');
    }

    return res.status(200).json({ report: reportText });

  } catch (err) {
    console.error('Anthropic error:', err);
    return res.status(500).json({ error: 'Error generating report' });
  }
}
