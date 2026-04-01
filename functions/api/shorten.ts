interface Env {
  URL_SHORTENER: KVNamespace
}

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_LENGTH = 6

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CHARS[b % CHARS.length]).join('')
}

export const onRequestPost: PagesFunction<Env> = async context => {
  try {
    const body = (await context.request.json()) as { query?: string }
    const query = body.query
    if (typeof query !== 'string' || query.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Generate code with collision check (1 retry)
    let code = generateCode()
    let existing = await context.env.URL_SHORTENER.get(code)
    if (existing !== null) {
      code = generateCode()
      existing = await context.env.URL_SHORTENER.get(code)
      if (existing !== null) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate unique code' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    await context.env.URL_SHORTENER.put(code, query)

    const url = new URL(context.request.url)
    const shortUrl = `${url.origin}/s/${code}`

    return new Response(JSON.stringify({ url: shortUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
