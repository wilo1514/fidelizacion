import { config } from "../config.js";
async function login() {
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
    const body = await response.json();
    const routeCookie = cookies.find((item) => item.startsWith("ROUTEID="));
    return {
        sessionId: body.SessionId,
        routeId: routeCookie ? routeCookie.split("=")[1]?.split(";")[0] ?? null : null
    };
}
function cookieHeader(session) {
    return session.routeId
        ? `B1SESSION=${session.sessionId}; ROUTEID=${session.routeId}`
        : `B1SESSION=${session.sessionId}`;
}
export async function updateBusinessPartnerByDocument(documentNumber, data) {
    const session = await login();
    const escapedDocument = documentNumber.replace(/'/g, "''");
    const filter = encodeURIComponent(`U_DOCUMENTO eq '${escapedDocument}'`);
    const queryResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners?$select=CardCode&$filter=${filter}`, {
        headers: { Cookie: cookieHeader(session) }
    });
    if (!queryResponse.ok) {
        throw new Error(`SAP query failed with status ${queryResponse.status}`);
    }
    const body = await queryResponse.json();
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
                E_Mail: data.email
            })
        });
        if (!patchResponse.ok) {
            throw new Error(`SAP patch failed with status ${patchResponse.status} for CardCode ${partner.CardCode}`);
        }
        if (data.addressLine) {
            const addressFilter = encodeURIComponent(`CardCode eq '${partner.CardCode.replace(/'/g, "''")}' and AdresType eq 'S'`);
            const addressResponse = await fetch(`${config.sap.baseUrl}/BPAddresses?$select=RowNum,CardCode,AddressName,AdresType,Street&$filter=${addressFilter}`, {
                headers: { Cookie: cookieHeader(session) }
            });
            if (!addressResponse.ok) {
                throw new Error(`SAP address query failed with status ${addressResponse.status} for CardCode ${partner.CardCode}`);
            }
            const addressBody = await addressResponse.json();
            for (const address of addressBody.value) {
                const addressPatchResponse = await fetch(`${config.sap.baseUrl}/BusinessPartners('${partner.CardCode}')`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Cookie: cookieHeader(session)
                    },
                    body: JSON.stringify({
                        BPAddresses: [
                            {
                                RowNum: address.RowNum,
                                AddressName: address.AddressName,
                                AdresType: address.AdresType,
                                Street: data.addressLine
                            }
                        ]
                    })
                });
                if (!addressPatchResponse.ok) {
                    throw new Error(`SAP address patch failed with status ${addressPatchResponse.status} for CardCode ${partner.CardCode}`);
                }
            }
        }
    }
    return { found: true };
}
