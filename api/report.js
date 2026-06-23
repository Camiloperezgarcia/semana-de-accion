export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, momento, tipo_emprendedor, horas_disponibles, cuello_botella } = req.body;

  if (!name || !momento || !tipo_emprendedor || !horas_disponibles || !cuello_botella) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ── Textos legibles para cada respuesta ──
  const momentoTextos = {
    A: 'Está empezando, todavía no tiene claridad total de su oferta o mensaje',
    B: 'Ya tiene claridad de qué hace, pero le falta consistencia para ejecutar cada semana',
    C: 'Ya vende, pero siente que no escala, todo depende de él/ella'
  };

  const tipoTextos = {
    A: 'Mentor — monetiza su conocimiento y experiencia',
    B: 'Prestador de servicios — agencia, diseño, copy, embudos, trafficker, closer, etc.',
    C: 'Creador de contenido / Influencer — construye audiencia y monetiza con marca, afiliación o producto propio'
  };

  const horasTextos = {
    A: 'Menos de 5 horas esta semana',
    B: 'Entre 5 y 15 horas esta semana',
    C: 'Más de 15 horas esta semana'
  };

  const cuelloTextos = {
    A: 'Contenido y comunidad — no está publicando o nadie interactúa',
    B: 'Producto o servicio — no tiene claro qué está ofreciendo o necesita mejorarlo',
    C: 'Ventas — tiene audiencia o producto, pero no está cerrando ventas'
  };

  // ── Tabla de prioridad pre-calculada: momento × cuello_botella ──
  const prioridadTabla = {
    'A-A': { prioridad: 'Definir tu mensaje y empezar a publicar', foco: 'Claridad de mensaje + primeras publicaciones' },
    'A-B': { prioridad: 'Definir tu oferta mínima viable', foco: 'Estructurar qué ofreces, a quién y a qué precio' },
    'A-C': { prioridad: 'Primero construye la base antes de vender', foco: 'Mensaje claro + oferta definida antes de pensar en ventas' },
    'B-A': { prioridad: 'Crear un sistema de contenido semanal sostenible', foco: 'Rutina de publicación consistente + interacción con tu comunidad' },
    'B-B': { prioridad: 'Pulir tu oferta para que sea clara y vendible', foco: 'Ajustar tu servicio o producto para que el mercado lo entienda rápido' },
    'B-C': { prioridad: 'Activar tu proceso de ventas', foco: 'Convertir tu audiencia existente en clientes con un proceso claro' },
    'C-A': { prioridad: 'Sistematizar tu contenido para que no dependa de ti', foco: 'Delegar o automatizar contenido para liberar tu tiempo' },
    'C-B': { prioridad: 'Estandarizar y escalar tu servicio', foco: 'Documentar procesos y crear paquetes replicables' },
    'C-C': { prioridad: 'Optimizar tu embudo de ventas', foco: 'Mejorar conversión en cada etapa del proceso de venta' }
  };

  // ── Cantidad de tareas según horas disponibles ──
  const alcanceTareas = {
    A: { tareas: '3 tareas máximo', nota: 'con menos de 5 horas, cada tarea debe ser de alto impacto y ejecutable en menos de 90 minutos' },
    B: { tareas: '5 tareas', nota: 'con 5 a 15 horas tiene espacio para avanzar en varias áreas sin saturarse' },
    C: { tareas: '7 tareas', nota: 'con más de 15 horas puede cubrir su prioridad principal y avanzar en áreas secundarias' }
  };

  const claveCombo = `${momento}-${cuello_botella}`;
  const prioridadInfo = prioridadTabla[claveCombo];
  const alcance = alcanceTareas[horas_disponibles];

  const prompt = `Eres Camilo Pérez García, mentor de emprendedores en negocios digitales con sede en Cali, Colombia. Tu tono es cercano, honesto, directo pero humano, como hablarle a un estudiante de confianza. Sin corporativo, sin hype, sin promesas vacías.

Genera un checklist personalizado de la semana para ${name}.

DATOS DEL EMPRENDEDOR:
- Momento del negocio: ${momentoTextos[momento]}
- Tipo de emprendedor: ${tipoTextos[tipo_emprendedor]}
- Horas disponibles: ${horasTextos[horas_disponibles]}
- Cuello de botella actual: ${cuelloTextos[cuello_botella]}

PRIORIDAD #1 CALCULADA: ${prioridadInfo.prioridad}
FOCO DE LA SEMANA: ${prioridadInfo.foco}

ALCANCE DEL CHECKLIST: ${alcance.tareas} (${alcance.nota})

El checklist debe tener entre 400 y 550 palabras. Usa exactamente esta estructura con estos títulos en markdown:

1. Saludo breve y personalizado a ${name} (1-2 líneas, sin título, algo como "Listo, ${name}. Tu semana ya tiene ruta.")

2. ## Tu prioridad #1 esta semana
   Explica cuál es la prioridad y por qué, conectándola con su momento y su cuello de botella. Sé específico, no genérico. (2-3 líneas)

3. ## Tu checklist de la semana
   Lista exactamente ${alcance.tareas} concretas, específicas y accionables. Cada tarea debe:
   - Empezar con un emoji de checkbox (☐)
   - Ser una acción concreta, no un concepto abstracto
   - Incluir un tiempo estimado realista
   - Estar adaptada al tipo de emprendedor (${tipoTextos[tipo_emprendedor]})
   
   Ejemplo de formato:
   ☐ **Escribir 3 ideas de contenido** basadas en preguntas frecuentes de tus clientes (30 min)

4. ## Tu acción #1 para hoy
   Una sola acción que puede hacer hoy mismo, en menos de 30 minutos, que le dé impulso para arrancar la semana. Sé muy concreto.

REGLAS IMPORTANTES:
- Habla en segunda persona (tú)
- Usa lenguaje neutro e inclusivo: evita términos que asuman género
- Las tareas deben ser ESPECÍFICAS para su tipo de emprendedor y su cuello de botella, no genéricas
- No incluyas tareas que no pueda hacer con las horas que tiene disponibles
- Tono: cercano, práctico, como alguien que ya recorrió este camino y te dice exactamente qué hacer
- Cuando uses palabras entre asteriscos simples como *palabra*, escríbelas entre doble asterisco **palabra** para que queden en negrilla
- Evita usar guiones largos (—) en el texto; usa comas o punto y coma para separar ideas
- NO incluyas CTA al programa ni mención de "Estructura que Expande"
- Al final del checklist, después de la acción #1, agrega exactamente este bloque de firma con los saltos de línea:

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
        max_tokens: 1200,
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
