import { headers } from "next/headers";

function isLocalHost(host: string) {
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];

  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (host === null) {
    throw new Error("Missing request host for admin attendance API fetch.");
  }

  const protocol = requestHeaders.get("x-forwarded-proto");

  if (protocol !== null) {
    return `${protocol}://${host}`;
  }

  if (isLocalHost(host)) {
    return `http://${host}`;
  }

  throw new Error("Missing request protocol for admin attendance API fetch.");
}
