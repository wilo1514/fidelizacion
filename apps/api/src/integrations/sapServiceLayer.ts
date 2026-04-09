import { config } from "../config.js";

type SapLoginResult = {
  sessionId: string;
  routeId: string | null;
};

async function login(): Promise<SapLoginResult> {
  const response = await fetch(`${config.sap.baseUrl}/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CompanyDB: config.sap.companyDb,
      UserName: config.sap.username,
      Password: config.sap.password
    })
  });

  if (!response.ok) {
    throw new Error(`SAP login failed with status ${response.status}`);
  }

  const cookies = response.headers.getSetCookie?.() ?? [];
  const body = await response.json() as { SessionId: string };
  const routeCookie = cookies.find((item) => item.startsWith("ROUTEID="));

  return {
    sessionId: body.SessionId,
    routeId: routeCookie ? routeCookie.split("=")[1]?.split(";")[0] ?? null : null
  };
}

function cookieHeader(session: SapLoginResult) {
  return session.routeId
    ? `B1SESSION=${session.sessionId}; ROUTEID=${session.routeId}`
    : `B1SESSION=${session.sessionId}`;
}

export async function updateBusinessPartnerByTaxId(documentNumber: string, data: {
  fullName: string;
  mobilePhone: string;
  email: string;
}) {
  const session = await login();
  const filter = encodeURIComponent(`FederalTaxID eq '${documentNumber}'`);
  const queryResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners?$select=CardCode&$filter=${filter}`, {
    headers: { Cookie: cookieHeader(session) }
  });

  if (!queryResponse.ok) {
    throw new Error(`SAP query failed with status ${queryResponse.status}`);
  }

  const body = await queryResponse.json() as { value: Array<{ CardCode: string }> };
  const partner = body.value[0];

  if (!partner) {
    return { found: false };
  }

  const patchResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners('${partner.CardCode}')`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(session)
    },
    body: JSON.stringify({
      CardName: data.fullName,
      Cellular: data.mobilePhone,
      EmailAddress: data.email
    })
  });

  if (!patchResponse.ok) {
    throw new Error(`SAP patch failed with status ${patchResponse.status}`);
  }

  return { found: true };
}
