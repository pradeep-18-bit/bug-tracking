const GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_TOKEN_BASE_URL = "https://login.microsoftonline.com";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

let cachedAppToken = null;
let cachedAppTokenExpiresAt = 0;

const normalizeString = (value = "") => String(value || "").trim();

const resolveGraphBaseUrl = () =>
  normalizeString(process.env.MICROSOFT_GRAPH_BASE_URL) || GRAPH_API_BASE_URL;

const resolveTenantId = () => normalizeString(process.env.MICROSOFT_TENANT_ID);
const resolveClientId = () => normalizeString(process.env.MICROSOFT_CLIENT_ID);
const resolveClientSecret = () => normalizeString(process.env.MICROSOFT_CLIENT_SECRET);

const hasClientCredentialConfig = () =>
  Boolean(resolveTenantId() && resolveClientId() && resolveClientSecret());

const getDelegatedAccessToken = () =>
  normalizeString(
    process.env.MICROSOFT_GRAPH_ACCESS_TOKEN || process.env.MS_GRAPH_ACCESS_TOKEN
  );

const hasGlobalFetch = () => typeof fetch === "function";

const parseGraphErrorPayload = async (response) => {
  try {
    const payload = await response.json();

    if (payload?.error?.message) {
      return payload.error.message;
    }

    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const getAppAccessToken = async () => {
  const now = Date.now();

  if (cachedAppToken && cachedAppTokenExpiresAt - 90_000 > now) {
    return cachedAppToken;
  }

  if (!hasGlobalFetch()) {
    throw new Error("Node.js runtime must support fetch for Graph API calls");
  }

  const tenantId = resolveTenantId();
  const clientId = resolveClientId();
  const clientSecret = resolveClientSecret();

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Graph credentials are not configured. Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET."
    );
  }

  const tokenUrl = `${GRAPH_TOKEN_BASE_URL}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials",
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const graphErrorMessage = await parseGraphErrorPayload(response);
    throw new Error(
      graphErrorMessage ||
        "Unable to authenticate with Microsoft Graph using client credentials"
    );
  }

  const payload = await response.json();

  if (!payload?.access_token) {
    throw new Error("Microsoft Graph token response did not include an access token");
  }

  cachedAppToken = payload.access_token;
  const expiresInSeconds = Number(payload.expires_in || 3600);
  cachedAppTokenExpiresAt = now + Math.max(expiresInSeconds, 60) * 1000;

  return cachedAppToken;
};

const resolveMeetingEndpoint = (organizerEmail = "") => {
  const normalizedOrganizerEmail = normalizeString(organizerEmail).toLowerCase();
  const delegatedToken = getDelegatedAccessToken();
  const graphBaseUrl = resolveGraphBaseUrl();

  if (delegatedToken) {
    return {
      endpoint: `${graphBaseUrl}/me/onlineMeetings`,
      authMode: "delegated",
    };
  }

  if (!normalizedOrganizerEmail) {
    throw new Error(
      "Organizer email is required when scheduling a meeting with app credentials"
    );
  }

  return {
    endpoint: `${graphBaseUrl}/users/${encodeURIComponent(normalizedOrganizerEmail)}/onlineMeetings`,
    authMode: "application",
  };
};

const getGraphAccessToken = async () => {
  const delegatedToken = getDelegatedAccessToken();

  if (delegatedToken) {
    return delegatedToken;
  }

  if (!hasClientCredentialConfig()) {
    throw new Error(
      "Microsoft Graph is not configured. Provide MICROSOFT_GRAPH_ACCESS_TOKEN or client credentials (MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)."
    );
  }

  return getAppAccessToken();
};

const createOnlineMeeting = async ({
  subject,
  startDateTime,
  endDateTime,
  attendees = [],
  organizerEmail = "",
}) => {
  if (!hasGlobalFetch()) {
    throw new Error("Node.js runtime must support fetch for Graph API calls");
  }

  const title = normalizeString(subject);

  if (!title) {
    throw new Error("Meeting title is required");
  }

  if (!startDateTime || !endDateTime) {
    throw new Error("Meeting start and end time are required");
  }

  const accessToken = await getGraphAccessToken();
  const { endpoint } = resolveMeetingEndpoint(organizerEmail);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: title,
      startDateTime,
      endDateTime,
      participants: {
        attendees,
      },
    }),
  });

  if (!response.ok) {
    const graphErrorMessage = await parseGraphErrorPayload(response);
    throw new Error(
      graphErrorMessage || `Microsoft Graph failed with status ${response.status}`
    );
  }

  const payload = await response.json();
  const joinUrl = payload?.joinWebUrl || payload?.joinUrl || "";
  const meetingId = payload?.id || payload?.meetingId || "";

  if (!joinUrl || !meetingId) {
    throw new Error("Microsoft Graph did not return a join URL or meeting id");
  }

  return {
    joinUrl,
    meetingId,
    startDateTime: payload?.startDateTime || startDateTime,
    endDateTime: payload?.endDateTime || endDateTime,
    raw: payload,
  };
};

module.exports = {
  createOnlineMeeting,
};
