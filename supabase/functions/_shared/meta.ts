// ============================================================
// Cliente HTTP para a API Oficial do WhatsApp (Meta Cloud API / Graph API)
// Substitui Z-API/W-API. Todas as mensagens são iniciadas pela
// plataforma, então usamos Templates de Mensagem pré-aprovados
// (não texto livre, que só funciona dentro da janela de 24h).
// Requer: META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID
// ============================================================

const META_BASE_URL         = 'https://graph.facebook.com/v25.0'
const META_PHONE_NUMBER_ID  = Deno.env.get('META_PHONE_NUMBER_ID')!
const META_WHATSAPP_TOKEN   = Deno.env.get('META_WHATSAPP_TOKEN')!

export class MetaApiError extends Error {
  statusCode: number
  code?: number
  constructor(statusCode: number, code: number | undefined, message: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

// Normaliza telefone brasileiro para o formato DDI+DDD+numero (ex: 5575991234567)
export function normalizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null
  let digits = tel.replace(/\D/g, '')
  if (digits.length === 0) return null

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }

  if (digits.length === 10) {
    digits = digits.slice(0, 2) + '9' + digits.slice(2)
  }

  if (digits.length !== 11) return null

  return '55' + digits
}

async function postMessage(body: Record<string, unknown>): Promise<any> {
  const resp = await fetch(`${META_BASE_URL}/${META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
  })

  const json = await resp.json().catch(() => ({} as any))

  if (!resp.ok) {
    const err = json?.error || {}
    throw new MetaApiError(resp.status, err.code, err.message || `Meta HTTP ${resp.status}`)
  }

  return json
}

// Envia um template de texto (body) com parâmetros posicionais {{1}}, {{2}}...
// `idioma` precisa bater exatamente com o idioma aprovado no WhatsApp Manager
// para esse template (a maioria é 'pt_BR', mas confira antes de assumir).
export async function enviarTemplate(
  telefone: string,
  templateName: string,
  parametros: string[] = [],
  idioma = 'pt_BR'
): Promise<void> {
  const numero = normalizarTelefone(telefone)
  if (!numero) throw new Error(`Telefone inválido: ${telefone}`)

  await postMessage({
    to: numero,
    type: 'template',
    template: {
      name: templateName,
      language: { code: idioma },
      components: parametros.length
        ? [{ type: 'body', parameters: parametros.map((texto) => ({ type: 'text', text: texto })) }]
        : []
    }
  })
}

// Faz upload de um arquivo (base64) para a API de mídia da Meta e retorna o media id
export async function uploadMedia(base64: string, mimeType: string, filename: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', new Blob([bytes], { type: mimeType }), filename)

  const resp = await fetch(`${META_BASE_URL}/${META_PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${META_WHATSAPP_TOKEN}` },
    body: form
  })

  const json = await resp.json().catch(() => ({} as any))
  if (!resp.ok) {
    const err = json?.error || {}
    throw new MetaApiError(resp.status, err.code, err.message || `Meta HTTP ${resp.status}`)
  }

  return json.id as string
}

// Envia um template com cabeçalho de documento (ex.: relatório em PDF)
export async function enviarDocumentoTemplateBase64(
  telefone: string,
  templateName: string,
  base64: string,
  filename: string,
  mimeType = 'application/pdf',
  idioma = 'pt_BR'
): Promise<void> {
  const numero = normalizarTelefone(telefone)
  if (!numero) throw new Error(`Telefone inválido: ${telefone}`)

  const mediaId = await uploadMedia(base64, mimeType, filename)

  await postMessage({
    to: numero,
    type: 'template',
    template: {
      name: templateName,
      language: { code: idioma },
      components: [{
        type: 'header',
        parameters: [{ type: 'document', document: { id: mediaId, filename } }]
      }]
    }
  })
}
