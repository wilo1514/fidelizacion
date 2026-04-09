type HeaderMap = Record<string, string | string[] | undefined>;

function headerValue(headers: HeaderMap, name: string) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function getClientContext(request: {
  ip?: string;
  headers: HeaderMap;
}) {
  const forwardedFor = headerValue(request.headers, "x-forwarded-for");
  const realIp = headerValue(request.headers, "x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || request.ip || null;

  const deviceInfo = {
    userAgent: headerValue(request.headers, "user-agent"),
    browserHints: headerValue(request.headers, "sec-ch-ua"),
    platform: headerValue(request.headers, "sec-ch-ua-platform"),
    mobile: headerValue(request.headers, "sec-ch-ua-mobile"),
    acceptLanguage: headerValue(request.headers, "accept-language")
  };

  return {
    ipAddress,
    deviceInfo: JSON.stringify(deviceInfo)
  };
}
