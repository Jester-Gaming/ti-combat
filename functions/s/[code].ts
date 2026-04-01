interface Env {
  URL_SHORTENER: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async context => {
  const code = context.params.code as string
  const query = await context.env.URL_SHORTENER.get(code)

  if (query === null) {
    return Response.redirect(new URL('/', context.request.url).toString(), 302)
  }

  return Response.redirect(
    new URL(`/?${query}`, context.request.url).toString(),
    302,
  )
}
