import { NextRequest, NextResponse } from "next/server";

const DEFAULT_UPSTREAM_WEB_API_BASE_URL = "http://localhost:4000/api/web/v1";
const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function getUpstreamWebApiBaseUrl() {
  return (
    process.env.WEB_API_BASE_URL ||
    process.env.NEXT_PUBLIC_WEB_API_BASE_URL ||
    DEFAULT_UPSTREAM_WEB_API_BASE_URL
  );
}

function buildUpstreamUrl(request: NextRequest, path: string[]) {
  const upstreamUrl = new URL(
    path.join("/"),
    `${getUpstreamWebApiBaseUrl().replace(/\/$/, "")}/`,
  );
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

function createUpstreamHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  return headers;
}

function createClientHeaders(response: Response) {
  const headers = new Headers(response.headers);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  return headers;
}

async function forwardWebApiRequest(request: NextRequest, path: string[]) {
  const requestInit: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: createUpstreamHeaders(request),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    cache: "no-store",
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    requestInit.duplex = "half";
  }

  const upstreamResponse = await fetch(buildUpstreamUrl(request, path), requestInit);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: createClientHeaders(upstreamResponse),
  });
}

type WebApiProxyRouteProps = {
  params: Promise<{
    path: string[];
  }>;
};

async function handleRequest(request: NextRequest, { params }: WebApiProxyRouteProps) {
  const { path } = await params;
  return forwardWebApiRequest(request, path);
}

export const dynamic = "force-dynamic";

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
