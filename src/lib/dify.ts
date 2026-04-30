const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? "https://api.dify.ai/v1";

type DifyWorkflowResponse = {
  data?: {
    outputs?: Record<string, unknown>;
  };
  message?: string;
};

type DifyChatResponse = {
  answer?: string;
  message?: string;
};

type DifyDocumentMetadataItem = {
  name?: string;
  key?: string;
  field?: string;
  value?: unknown;
};

type DifyDocumentListItem = {
  id: string;
  name: string;
  enabled?: boolean;
  archived?: boolean;
  doc_metadata?: DifyDocumentMetadataItem[] | Record<string, unknown>;
};

type DifyDocumentListResponse = {
  data?: DifyDocumentListItem[];
  has_more?: boolean;
  page?: number;
};

type DifySegmentItem = {
  id: string;
  content?: string;
  enabled?: boolean;
  status?: string;
};

type DifySegmentListResponse = {
  data?: DifySegmentItem[];
  has_more?: boolean;
  page?: number;
};

export type TableOption = {
  name: string;
  logicalName?: string;
  displayName: string;
};

function buildHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function parseDifyResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`Dify returned invalid JSON: ${rawText.slice(0, 200)}`);
    }
  }

  throw new Error(`Dify returned non-JSON response: ${rawText.slice(0, 200)}`);
}

function getKnowledgeConfig() {
  const apiKey = process.env.DIFY_API_KEY_KB;
  const datasetId = process.env.DIFY_KB_DATASET_ID;

  if (!apiKey) {
    throw new Error("DIFY_API_KEY_KB is not set.");
  }

  if (!datasetId) {
    throw new Error("DIFY_KB_DATASET_ID is not set.");
  }

  return {
    apiKey,
    datasetId: datasetId.replace(/^dataset-/, ""),
  };
}

async function fetchKnowledgeJson(path: string) {
  const { apiKey } = getKnowledgeConfig();
  const response = await fetch(`${DIFY_BASE_URL}${path}`, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  const data = await parseDifyResponse(response);
  if (!response.ok) {
    throw new Error((typeof data.message === "string" && data.message) || "Dify knowledge request failed.");
  }

  return data;
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeMetadata(
  value: DifyDocumentMetadataItem[] | Record<string, unknown> | undefined,
) {
  if (!value) return {} as Record<string, unknown>;

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => {
          const metadataKey = item.name ?? item.key ?? item.field;
          if (typeof metadataKey !== "string") return null;
          return [metadataKey, item.value];
        })
        .filter((entry): entry is [string, unknown] => entry !== null),
    );
  }

  return value;
}

function matchesProjectMetadata(
  metadata: Record<string, unknown>,
  project: {
    id: string;
    name: string;
    kbFile: string;
  },
) {
  const kbFile = metadata.kb_file;
  const projectId = metadata.project_id;
  const projectName = metadata.project_name;

  return kbFile === project.kbFile || projectId === project.id || projectName === project.name;
}

function extractTableName(document: DifyDocumentListItem, metadata: Record<string, unknown>) {
  const candidateKeys = ["table_name", "table", "name"];
  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return stripExtension(document.name);
}

function matchesProjectDocument(
  document: DifyDocumentListItem,
  metadata: Record<string, unknown>,
  project: {
    id: string;
    name: string;
    kbFile: string;
  },
) {
  if (matchesProjectMetadata(metadata, project)) {
    return true;
  }

  return document.name === project.kbFile || stripExtension(document.name) === stripExtension(project.kbFile);
}

function normalizeTableIdentifier(raw: string) {
  const cleaned = raw.replace(/[;"`]/g, "").replace(/^\s+|\s+$/g, "").replace(/\r|\n/g, "");

  return cleaned;
}

function buildTableDisplayName(name: string, logicalName?: string) {
  const normalizedLogicalName = logicalName?.trim();
  if (!normalizedLogicalName) {
    return name;
  }

  if (normalizedLogicalName.toLowerCase() === name.trim().toLowerCase()) {
    return name;
  }

  return `${name}（${normalizedLogicalName}）`;
}

function extractTableDetailsFromContent(content: string) {
  const tableMap = new Map<string, TableOption>();
  const namePatterns = [
    /\bcreate\s+table\s+([^\s(;]+)/gi,
    /\bdrop\s+table\s+([^\s(;]+)/gi,
    /\balter\s+table\s+([^\s(;]+)/gi,
    /\btruncate\s+table\s+([^\s(;]+)/gi,
    /--\s*([^\s;()]+)\s*$/gm,
  ];
  const logicalNamePattern = /\bcomment\s+on\s+table\s+([^\s]+)\s+is\s+'([^']*(?:''[^']*)*)'/gi;

  for (const pattern of namePatterns) {
    for (const match of content.matchAll(pattern)) {
      const name = normalizeTableIdentifier(match[1] ?? "");
      const key = name.toLowerCase();
      if (!name || tableMap.has(key)) continue;
      tableMap.set(key, {
        name,
        displayName: name,
      });
    }
  }

  for (const match of content.matchAll(logicalNamePattern)) {
    const name = normalizeTableIdentifier(match[1] ?? "");
    const logicalName = (match[2] ?? "").replace(/''/g, "'").trim();
    if (!name) continue;
    const key = name.toLowerCase();

    const current = tableMap.get(key);
    const displayName = buildTableDisplayName(current?.name ?? name, logicalName || undefined);

    tableMap.set(key, {
      name: current?.name ?? name,
      logicalName,
      displayName,
    });
  }

  return [...tableMap.values()];
}

async function listDocumentSegments(datasetId: string, documentId: string) {
  const segments: DifySegmentItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const list = (await fetchKnowledgeJson(
      `/datasets/${datasetId}/documents/${documentId}/segments?page=${page}&limit=100&status=completed`,
    )) as DifySegmentListResponse;

    segments.push(...(list.data ?? []));
    hasMore = Boolean(list.has_more);
    page = (list.page ?? page) + 1;
  }

  return segments.filter((segment) => segment.enabled !== false);
}

export async function listProjectTables(project: {
  id: string;
  name: string;
  kbFile: string;
}) {
  const { datasetId } = getKnowledgeConfig();
  const documents: DifyDocumentListItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const list = (await fetchKnowledgeJson(
      `/datasets/${datasetId}/documents?page=${page}&limit=100&status=available`,
    )) as DifyDocumentListResponse;

    documents.push(...(list.data ?? []));
    hasMore = Boolean(list.has_more);
    page = (list.page ?? page) + 1;
  }

  const activeDocuments = documents.filter((document) => document.enabled !== false && document.archived !== true);
  const withMetadata = activeDocuments.map((document) => ({
    document,
    metadata: normalizeMetadata(document.doc_metadata),
  }));

  const hasProjectMetadata = withMetadata.some(({ metadata }) => Object.keys(metadata).length > 0);
  const filteredDocuments = hasProjectMetadata
    ? withMetadata.filter(({ document, metadata }) => matchesProjectDocument(document, metadata, project))
    : withMetadata;

  const tablesFromSegments = new Map<string, TableOption>();

  await Promise.all(
    filteredDocuments.map(async ({ document }) => {
      const segments = await listDocumentSegments(datasetId, document.id);
      for (const segment of segments) {
        for (const table of extractTableDetailsFromContent(segment.content ?? "")) {
          const key = table.name.toLowerCase();
          const existing = tablesFromSegments.get(key);
          if (!existing || (!existing.logicalName && table.logicalName)) {
            tablesFromSegments.set(key, table);
          }
        }
      }
    }),
  );

  if (tablesFromSegments.size > 0) {
    return [...tablesFromSegments.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "ja"),
    );
  }

  const fallbackTables = new Map<string, TableOption>();

  for (const { document, metadata } of filteredDocuments) {
    const name = extractTableName(document, metadata);
    if (!name) continue;
    const key = name.toLowerCase();

    const logicalName = typeof metadata.logical_name === "string" ? metadata.logical_name : undefined;
    fallbackTables.set(key, {
      name,
      logicalName,
      displayName: buildTableDisplayName(name, logicalName),
    });
  }

  return [...fallbackTables.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "ja"),
  );
}

function getWorkflowApiKey(purpose?: "sql" | "table_list" | "sql_review" | "table_summary") {
  if (purpose === "table_list") {
    return process.env.DIFY_API_KEY_TABLE_LIST ?? process.env.DIFY_API_KEY_SQL_CREATE ?? process.env.DIFY_API_KEY_SQL;
  }

  if (purpose === "sql_review") {
    return process.env.DIFY_API_KEY_SQL_REVIEW ?? process.env.DIFY_API_KEY_SQL_CREATE ?? process.env.DIFY_API_KEY_SQL;
  }

  if (purpose === "table_summary") {
    return process.env.DIFY_API_KEY_TABLE_SUMMARY ?? process.env.DIFY_API_KEY_CHAT;
  }

  return process.env.DIFY_API_KEY_SQL_CREATE ?? process.env.DIFY_API_KEY_SQL;
}

export async function runWorkflow(
  inputs: Record<string, unknown>,
  options?: {
    purpose?: "sql" | "table_list" | "sql_review" | "table_summary";
  },
) {
  const apiKey = getWorkflowApiKey(options?.purpose);
  if (!apiKey) {
    throw new Error(
      options?.purpose === "table_list"
        ? "DIFY_API_KEY_TABLE_LIST or DIFY_API_KEY_SQL_CREATE or DIFY_API_KEY_SQL is not set."
        : options?.purpose === "sql_review"
          ? "DIFY_API_KEY_SQL_REVIEW or DIFY_API_KEY_SQL_CREATE or DIFY_API_KEY_SQL is not set."
          : options?.purpose === "table_summary"
            ? "DIFY_API_KEY_TABLE_SUMMARY or DIFY_API_KEY_CHAT is not set."
            : "DIFY_API_KEY_SQL_CREATE or DIFY_API_KEY_SQL is not set.",
    );
  }

  const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      inputs,
      response_mode: "blocking",
      user: process.env.DIFY_WORKFLOW_USER ?? "sqlnavi-user",
    }),
  });

  const data = (await parseDifyResponse(response)) as DifyWorkflowResponse;
  if (!response.ok) {
    throw new Error(data.message ?? "Dify workflow request failed.");
  }

  return data.data?.outputs ?? {};
}

export async function runChat(params: {
  query: string;
  inputs?: Record<string, unknown>;
  purpose?: "default" | "sql_review" | "table_summary";
}) {
  const apiKey =
    params.purpose === "sql_review"
      ? process.env.DIFY_API_KEY_SQL_REVIEW ?? process.env.DIFY_API_KEY_CHAT
      : params.purpose === "table_summary"
        ? process.env.DIFY_API_KEY_TABLE_SUMMARY ?? process.env.DIFY_API_KEY_CHAT
        : process.env.DIFY_API_KEY_CHAT;
  if (!apiKey) {
    throw new Error(
      params.purpose === "sql_review"
        ? "DIFY_API_KEY_SQL_REVIEW or DIFY_API_KEY_CHAT is not set."
        : params.purpose === "table_summary"
          ? "DIFY_API_KEY_TABLE_SUMMARY or DIFY_API_KEY_CHAT is not set."
          : "DIFY_API_KEY_CHAT is not set.",
    );
  }

  const response = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      query: params.query,
      inputs: params.inputs ?? {},
      response_mode: "blocking",
      user: process.env.DIFY_CHAT_USER ?? "sqlnavi-user",
    }),
  });

  const data = (await parseDifyResponse(response)) as DifyChatResponse;
  if (!response.ok) {
    throw new Error(data.message ?? "Dify chat request failed.");
  }

  return data.answer ?? "";
}
