import { config } from "../config.js";

if (!config.sap.rejectUnauthorized) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

type SapLoginResult = {
  sessionId: string;
  routeId: string | null;
};

type SapBpAddress = Record<string, unknown> & {
  RowNum: number;
  AddressName: string;
  AdresType?: string;
  AddressType?: string;
  Street: string;
};

async function login(): Promise<SapLoginResult> {
  let response: Response;
  try {
    response = await fetch(`${config.sap.baseUrl}/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        CompanyDB: config.sap.companyDb,
        UserName: config.sap.username,
        Password: config.sap.password
      })
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown network error";
    throw new Error(`SAP login request failed to ${config.sap.baseUrl}/Login. ${detail}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SAP login failed with status ${response.status}. Body: ${errorBody}`);
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

async function getBusinessPartnerAddresses(session: SapLoginResult, cardCode: string) {
  const response = await fetch(`${config.sap.baseUrl}/BusinessPartners('${cardCode}')?$select=CardCode,BPAddresses`, {
    headers: { Cookie: cookieHeader(session) }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SAP address query failed with status ${response.status} for CardCode ${cardCode}. Body: ${errorBody}`);
  }

  const body = await response.json() as {
    CardCode: string;
    BPAddresses?: SapBpAddress[];
  };

  return body.BPAddresses ?? [];
}

function isShippingAddress(address: SapBpAddress) {
  return address.AdresType === "S" || address.AddressType === "bo_ShipTo";
}

export async function updateBusinessPartnerByDocument(documentNumber: string, data: {
  mobilePhone: string;
  email: string;
  addressLine: string | null;
}) {
  const session = await login();
  const escapedDocument = documentNumber.replace(/'/g, "''");
  const filter = encodeURIComponent(`U_DOCUMENTO eq '${escapedDocument}'`);
  const queryResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners?$select=CardCode&$filter=${filter}`, {
    headers: { Cookie: cookieHeader(session) }
  });

  if (!queryResponse.ok) {
    const errorBody = await queryResponse.text();
    throw new Error(`SAP query failed with status ${queryResponse.status}. Body: ${errorBody}`);
  }

  const body = await queryResponse.json() as { value: Array<{ CardCode: string }> };
  const partners = body.value;

  if (!partners.length) {
    return { found: false };
  }

  for (const partner of partners) {
    const patchResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners('${partner.CardCode}')`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(session)
      },
      body: JSON.stringify({
        Phone1: data.mobilePhone,
        EmailAddress: data.email,
        U_ACEPTACION: "S"
      })
    });

    if (!patchResponse.ok) {
      const errorBody = await patchResponse.text();
      throw new Error(`SAP patch failed with status ${patchResponse.status} for CardCode ${partner.CardCode}. Body: ${errorBody}`);
    }

    if (data.addressLine) {
      const addresses = await getBusinessPartnerAddresses(session, partner.CardCode);
      const hasShippingAddress = addresses.some((address) => isShippingAddress(address));

      if (!hasShippingAddress) {
        throw new Error(
          `SAP did not return any BPAddresses with AdresType 'S' for CardCode ${partner.CardCode}. ` +
          `Addresses: ${JSON.stringify(addresses)}`
        );
      }

      const patchedAddresses = addresses.map((address) => ({
        ...address,
        Street: isShippingAddress(address) ? data.addressLine : address.Street
      }));

      const addressPatchResponse = await fetch(
        `${config.sap.baseUrl}/BusinessPartners('${partner.CardCode}')`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeader(session),
            "B1S-ReplaceCollectionsOnPatch": "true"
          },
          body: JSON.stringify({
            BPAddresses: patchedAddresses
          })
        }
      );

      if (!addressPatchResponse.ok) {
        const errorBody = await addressPatchResponse.text();
        throw new Error(`SAP address patch failed with status ${addressPatchResponse.status} for CardCode ${partner.CardCode}. Body: ${errorBody}`);
      }

      const verifyAddresses = await getBusinessPartnerAddresses(session, partner.CardCode);
      const shippingAddressesAfter = verifyAddresses.filter((address) => isShippingAddress(address));
      const expectedStreet = data.addressLine.trim();
      const allUpdated = shippingAddressesAfter.every((address) => String(address.Street ?? "").trim() === expectedStreet);

      if (!allUpdated) {
        throw new Error(
          `SAP address patch was accepted but Street was not updated for CardCode ${partner.CardCode}. ` +
          `Expected "${expectedStreet}". Current shipping addresses: ${JSON.stringify(shippingAddressesAfter)}`
        );
      }
    }
  }

  return { found: true };
}
