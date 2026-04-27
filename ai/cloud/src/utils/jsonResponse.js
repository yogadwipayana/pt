export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

export function errorResponse(status, code, message, details = []) {
  return jsonResponse(
    {
      error: {
        code,
        message,
        details
      }
    },
    status
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
