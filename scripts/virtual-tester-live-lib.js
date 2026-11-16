/* Classification only: the network guard still blocks every backend request.
   Supabase read-only SQL functions can use POST, so method alone is not mutation proof. */
export function isLiveMutationRequest(rawUrl, method) {
  let url;
  try { url = new URL(rawUrl); } catch { return true; }
  if (/\/(?:admin_request_run|my_apply(?:_pipeline)?_action|apply-agent)$/.test(url.pathname)) return true;
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;
  const readOnlySearch = method === "POST" && url.origin === "https://ndrusywvceojsoirhkhl.supabase.co"
    && url.pathname === "/rest/v1/rpc/search_pdf_chunks_lex" && !url.username && !url.password;
  return !readOnlySearch;
}

/* Called only after requestPolicy approves a live static request. Keep failures
   fail-closed without printing exception text, headers, credentials or queries. */
export async function fulfillLiveStatic(route, errors) {
  const path = new URL(route.request().url()).pathname;
  let response;
  let fulfilled = false;
  let stage = "transport";
  try {
    // One attempt; HTTP failures return responses, while transport failures throw.
    response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 25_000 });
    stage = "response";
    const status = response.status();
    if (status >= 300 && status < 400) {
      errors.push(`Redirect rejected on approved static path: ${path}`);
    } else if (status >= 400) {
      errors.push(`Required asset HTTP ${status}: ${path}`);
    } else {
      stage = "fulfill";
      await route.fulfill({ response });
      fulfilled = true;
    }
  } catch {
    errors.push(`Required asset ${stage} failure: ${path}`);
  } finally {
    if (response) {
      try { await response.dispose(); }
      catch { errors.push(`Required asset dispose failure: ${path}`); }
    }
    if (!fulfilled) {
      try { await route.abort("blockedbyclient"); }
      catch { errors.push(`Required asset abort failure: ${path}`); }
    }
  }
}
