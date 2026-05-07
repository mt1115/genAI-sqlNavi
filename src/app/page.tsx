"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PROJECTS } from "@/lib/projects";

type ActiveTab = "sql-create" | "sql-review" | "table";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SelectOption = {
  value: string;
  label: string;
  searchText: string;
};

type TableApiOption = {
  name: string;
  logicalName?: string;
  displayName: string;
};

type FormattedBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "quote"; lines: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000\p{P}\p{S}]+/gu, "");
}

function CopyGlyph({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <path
          d="M5.5 12.5l4 4 9-9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.6" width="11" x="9" y="9" />
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.6" width="11" x="4" y="4" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg aria-hidden="true" className="sendGlyphIcon" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 18V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
      <path
        d="M7.5 11.5 12 7l4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg aria-hidden="true" className="sendGlyphIcon" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 12h13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
      <path
        d="M13.5 7.5 18 12l-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

function HelpTooltip({
  examples,
  note,
  onSelect,
}: {
  examples: Array<{ label: string; value: string }>;
  note?: string;
  onSelect: (value: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  return (
    <div
      className={hovered && !dismissed ? "helpTooltip open" : "helpTooltip"}
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
    >
      <button aria-label="入力例" className="helpTooltipButton" type="button">
        入力例
      </button>
      <div className="helpTooltipBubble">
        <div className="helpTooltipHeader">
          <div className="helpTooltipTitle">入力例</div>
          {note ? <div className="helpTooltipNote">{note}</div> : null}
        </div>
        <div className="helpTooltipList">
          {examples.map((example) => (
            <button
              className="helpTooltipExample"
              key={`${example.label}-${example.value}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(example.value);
                setDismissed(true);
              }}
              onClick={() => {
                onSelect(example.value);
                setDismissed(true);
              }}
              type="button"
            >
              <span className="helpTooltipExampleLabel">{example.label}</span>
              <span className="helpTooltipExampleValue">{example.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  options,
  value,
  placeholder,
  emptyText,
  disabled,
  onChange,
  labelPosition = "top",
}: {
  label: string;
  options: SelectOption[];
  value: string;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  labelPosition?: "top" | "left";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLabelElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = normalizeSearchValue(query.trim());
  const filteredOptions = normalizedQuery
    ? options.filter((option) => normalizeSearchValue(option.searchText).includes(normalizedQuery))
    : options;
  const inputValue = open ? query : selectedOption?.label || "";

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <label className={labelPosition === "left" ? "field fieldInline" : "field"} ref={rootRef}>
      <span>{label}</span>
      <div className={disabled ? "searchSelect disabled" : "searchSelect"}>
        <input
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          placeholder={placeholder}
          type="text"
          value={inputValue}
        />
        <button
          aria-label={`${label}の候補を開く`}
          className="searchSelectToggle"
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen((prev) => !prev);
          }}
          type="button"
        >
          ▾
        </button>
        {open && !disabled ? (
          <div className="searchSelectMenu">
            {filteredOptions.length === 0 ? (
              <div className="searchSelectEmpty">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  className={option.value === value ? "searchSelectOption active" : "searchSelectOption"}
                  key={option.value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option.value);
                  }}
                  onClick={() => handleSelect(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  return /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim());
}

function splitDescriptionCell(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) {
    return { logicalName: "", description: normalized };
  }

  return {
    logicalName: match[1].trim(),
    description: match[2].trim(),
  };
}

function normalizeDisplayTable(block: Extract<FormattedBlock, { type: "table" }>) {
  const columnNameIndex = block.headers.findIndex((header) => header.trim() === "カラム名");
  const descriptionIndex = block.headers.findIndex((header) => header.trim() === "説明");
  const logicalNameIndex = block.headers.findIndex((header) => header.trim() === "論理名");

  if (columnNameIndex === -1 || descriptionIndex === -1 || logicalNameIndex !== -1) {
    return block;
  }

  const headers = [...block.headers];
  headers.splice(columnNameIndex + 1, 0, "論理名");

  const rows = block.rows.map((row) => {
    const cells = [...row];
    const source = cells[descriptionIndex] ?? "";
    const { logicalName, description } = splitDescriptionCell(source);

    cells.splice(columnNameIndex + 1, 0, logicalName || "DDLからは確認できない");
    cells[descriptionIndex + 1] = description || "DDLからは確認できない";

    return cells;
  });

  return {
    ...block,
    headers,
    rows,
  };
}

function renderInlineMarkdown(text: string) {
  const tokens: Array<{ type: "text" | "strong" | "code"; value: string }> = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matched = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if (matched.startsWith("**") && matched.endsWith("**")) {
      tokens.push({ type: "strong", value: matched.slice(2, -2) });
    } else if (matched.startsWith("`") && matched.endsWith("`")) {
      tokens.push({ type: "code", value: matched.slice(1, -1) });
    }

    lastIndex = index + matched.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (tokens.length === 0) {
    tokens.push({ type: "text", value: text });
  }

  return tokens.map((token, tokenIndex) => {
    if (token.type === "strong") {
      return <strong key={`${token.type}-${tokenIndex}`}>{token.value}</strong>;
    }

    if (token.type === "code") {
      return (
        <code className="inlineCode" key={`${token.type}-${tokenIndex}`}>
          {token.value}
        </code>
      );
    }

    return <span key={`${token.type}-${tokenIndex}`}>{token.value}</span>;
  });
}

function parseFormattedBlocks(value: string): FormattedBlock[] {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: FormattedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().match(/^```\s*$/)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: fenceMatch[1] ?? "", code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (trimmed.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!(/^[-*]\s+/.test(current) || /^\d+\.\s+/.test(current))) break;
        items.push(current.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed.match(/^```(\w+)?\s*$/) ||
        currentTrimmed.match(/^(#{1,6})\s+(.+)$/) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed) ||
        /^>\s?/.test(currentTrimmed) ||
        (currentTrimmed.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function renderHeading(level: number, text: string, key: string) {
  if (level <= 1) {
    return (
      <h3 className="formattedHeading" key={key}>
        {renderInlineMarkdown(text)}
      </h3>
    );
  }

  if (level === 2) {
    return (
      <h4 className="formattedHeading" key={key}>
        {renderInlineMarkdown(text)}
      </h4>
    );
  }

  return (
    <h5 className="formattedHeading" key={key}>
      {renderInlineMarkdown(text)}
    </h5>
  );
}

function isInlineSummaryHeading(text: string) {
  const normalized = text.trim();
  return normalized === "制約" || normalized === "注意点" || normalized === "外部キー";
}

function renderInlineSummaryContent(block: Extract<FormattedBlock, { type: "paragraph" | "list" }>) {
  if (block.type === "paragraph") {
    return (
      <div className="formattedInlineSummaryText">
        {block.lines
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, lineIndex) => (
            <span className="formattedLine" key={`${line}-${lineIndex}`}>
              {renderInlineMarkdown(line)}
            </span>
          ))}
      </div>
    );
  }

  return (
    <ul className="formattedInlineSummaryList">
      {block.items.map((item, itemIndex) => (
        <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
      ))}
    </ul>
  );
}

function FormattedContent({ value, placeholder }: { value: string; placeholder?: string }) {
  const blocks = parseFormattedBlocks(value);

  if (!value.trim()) {
    return <div className="formattedEmpty">{placeholder ?? ""}</div>;
  }

  return (
    <div className="formattedContent">
      {blocks.map((rawBlock, blockIndex) => {
        const block = rawBlock.type === "table" ? normalizeDisplayTable(rawBlock) : rawBlock;
        const nextRawBlock = blocks[blockIndex + 1];
        const nextBlock = nextRawBlock?.type === "table" ? normalizeDisplayTable(nextRawBlock) : nextRawBlock;
        const prevRawBlock = blocks[blockIndex - 1];
        const prevBlock = prevRawBlock?.type === "table" ? normalizeDisplayTable(prevRawBlock) : prevRawBlock;
        const key = `${block.type}-${blockIndex}`;

        if (
          (block.type === "paragraph" || block.type === "list") &&
          prevBlock?.type === "heading" &&
          isInlineSummaryHeading(prevBlock.text)
        ) {
          return null;
        }

        if (block.type === "heading") {
          if (
            isInlineSummaryHeading(block.text) &&
            nextBlock &&
            (nextBlock.type === "paragraph" || nextBlock.type === "list")
          ) {
            return (
              <div className="formattedInlineSummaryRow" key={key}>
                <span className="formattedInlineSummaryHeading">{renderInlineMarkdown(block.text)}</span>
                {renderInlineSummaryContent(nextBlock)}
              </div>
            );
          }

          return renderHeading(block.level, block.text, key);
        }

        if (block.type === "code") {
          return (
            <section className="formattedCodeBlock" key={key}>
              {block.language ? <span className="codeLanguage">{block.language}</span> : null}
              <pre>{block.code}</pre>
            </section>
          );
        }

        if (block.type === "list") {
          return (
            <ul className="formattedList" key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote className="formattedQuote" key={key}>
              {block.lines.map((line, lineIndex) => (
                <span className="formattedLine" key={`${key}-${lineIndex}`}>
                  {renderInlineMarkdown(line)}
                </span>
              ))}
            </blockquote>
          );
        }

        if (block.type === "table") {
          return (
            <div className="formattedTableWrap" key={key}>
              <table className="formattedTable">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${key}-${headerIndex}`}>{renderInlineMarkdown(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${key}-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p className="formattedParagraph" key={key}>
            {block.lines.map((line, lineIndex) => (
              <span className="formattedLine" key={`${key}-${lineIndex}`}>
                {renderInlineMarkdown(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      aria-label={copied ? `${label} copied` : `${label} copy`}
      className={copied ? "copyButton copied" : "copyButton"}
      disabled={!value}
      onClick={handleCopy}
      type="button"
    >
      <CopyGlyph copied={copied} />
    </button>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="thinkingState" role="status" aria-live="polite">
      <div className="thinkingDots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}

function ResponsePanel({
  title,
  description,
  value,
  placeholder,
  copyValue,
  hideCopy = false,
  loading = false,
  loadingLabel,
}: {
  title: string;
  description: string;
  value: string;
  placeholder?: string;
  copyValue?: string;
  hideCopy?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <section className="surface outputSurface">
      <div className="surfaceHeader">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {!hideCopy && !loading ? <CopyButton label={title} value={copyValue ?? value} /> : null}
      </div>
      <div className="responseBox formattedPanel">
        {loading ? (
          <ThinkingIndicator label={loadingLabel ?? "回答を生成中です..."} />
        ) : (
          <FormattedContent placeholder={placeholder ?? "出力結果はここに表示されます。"} value={value} />
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("sql-create");
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].id);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  const [sqlRequest, setSqlRequest] = useState("");
  const [sqlResponse, setSqlResponse] = useState("");
  const [sqlLoading, setSqlLoading] = useState(false);

  const [sqlReviewRequest, setSqlReviewRequest] = useState("");
  const [sqlReviewResponse, setSqlReviewResponse] = useState("");
  const [sqlReviewLoading, setSqlReviewLoading] = useState(false);

  const [tableOptions, setTableOptions] = useState<SelectOption[]>([]);
  const [tableOptionsLoading, setTableOptionsLoading] = useState(false);
  const [tableOptionsError, setTableOptionsError] = useState("");
  const [tableName, setTableName] = useState("");
  const [tableRequest, setTableRequest] = useState("");
  const [tableSummary, setTableSummary] = useState("");
  const [tableSummaryLoading, setTableSummaryLoading] = useState(false);
  const [tableQuestionLoading, setTableQuestionLoading] = useState(false);
  const [tableMessages, setTableMessages] = useState<ChatMessage[]>([]);

  const selectedProjectInfo = useMemo(
    () => PROJECTS.find((project) => project.id === selectedProject) ?? PROJECTS[0],
    [selectedProject],
  );

  useEffect(() => {
    if (!aboutModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAboutModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aboutModalOpen]);

  const projectOptions = useMemo<SelectOption[]>(
    () =>
      PROJECTS.map((project) => ({
        value: project.id,
        label: project.name,
        searchText: `${project.id} ${project.name} ${project.description}`.trim(),
      })),
    [],
  );

  const normalizeSqlResponse = (text: string) => {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:sql)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1] ? fenced[1].trim() : trimmed;
  };

  const sqlCreateCopyBlocked =
    sqlResponse.trim() === "SQLが作成できませんでした。プロンプトを変えてお試し下さい。";

  const tableQuestionExamples = [
    "このテーブルの主キーは何ですか？",
    "更新時に注意するカラムはありますか？",
    "他のテーブルとのつながりを教えてください",
  ];

  useEffect(() => {
    if (activeTab !== "table") return;

    setTableOptionsLoading(true);
    setTableOptions([]);
    setTableOptionsError("");
    setTableName("");
    setTableSummary("");
    setTableMessages([]);

    void (async () => {
      try {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: selectedProject }),
        });

        const data = (await res.json()) as { tables?: TableApiOption[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "テーブル一覧を取得できませんでした。");
        }

        setTableOptions(
          (data.tables ?? []).map((table) => ({
            value: table.name,
            label: table.displayName,
            searchText: `${table.name} ${table.logicalName ?? ""} ${table.displayName}`.trim(),
          })),
        );
      } catch (error) {
        setTableOptions([]);
        setTableOptionsError(error instanceof Error ? error.message : "テーブル一覧を取得できませんでした。");
        setTableSummary("");
      } finally {
        setTableOptionsLoading(false);
      }
    })();
  }, [activeTab, selectedProject]);

  useEffect(() => {
    if (activeTab !== "table") return;
    if (!tableName) {
      setTableSummary("");
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setTableSummaryLoading(true);

        try {
          const res = await fetch("/api/chat/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: selectedProject,
              question: `${tableName} のテーブル定義を要約してください。制約、注意点、他テーブルとのつながりを簡潔にまとめ、カラム一覧はMarkdownの表で返してください。`,
              contextType: "table_summary",
              tableName,
            }),
          });

          const data = (await res.json()) as { answer?: string; error?: string };
          if (!res.ok) {
            throw new Error(data.error ?? "テーブル要約を生成できませんでした。");
          }

          setTableSummary(data.answer ?? "");
        } catch (error) {
          setTableSummary(error instanceof Error ? error.message : "テーブル要約を生成できませんでした。");
        } finally {
          setTableSummaryLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeTab, selectedProject, tableName]);

  const runSqlGenerate = async () => {
    if (!sqlRequest.trim()) return;

    setSqlLoading(true);
    setSqlResponse("");

    try {
      const res = await fetch("/api/sql/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          prompt: sqlRequest,
        }),
      });

      const data = (await res.json()) as { sql?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "SQLを生成できませんでした。");
      }

      setSqlResponse(normalizeSqlResponse(data.sql ?? ""));
    } catch (error) {
      setSqlResponse(error instanceof Error ? error.message : "SQLを生成できませんでした。");
    } finally {
      setSqlLoading(false);
    }
  };

  const runSqlReview = async () => {
    if (!sqlReviewRequest.trim()) return;

    setSqlReviewLoading(true);
    setSqlReviewResponse("");

    try {
      const res = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          question: sqlReviewRequest,
          contextType: "sql_review",
          tableName: null,
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "SQLを解析できませんでした。");
      }

      setSqlReviewResponse(data.answer ?? "");
    } catch (error) {
      setSqlReviewResponse(error instanceof Error ? error.message : "SQLを解析できませんでした。");
    } finally {
      setSqlReviewLoading(false);
    }
  };

  const runTableQuestion = async () => {
    const question = tableRequest.trim();
    if (!question || !tableName) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: question,
    };

    setTableQuestionLoading(true);
    setTableRequest("");
    setTableMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          question,
          contextType: "table_analysis",
          tableName,
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "テーブル解析チャットの回答を取得できませんでした。");
      }

      setTableMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: data.answer ?? "",
        },
      ]);
    } catch (error) {
      setTableMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          content: error instanceof Error ? error.message : "テーブル解析チャットの回答を取得できませんでした。",
        },
      ]);
    } finally {
      setTableQuestionLoading(false);
    }
  };

  return (
    <main className="appShell">
      <div className="headerBand">
        <section className="mainStage headerStage">
          <div className="pageTitleRow">
            <h1 className="pageTitle">SQLNavi</h1>
            <button
              className="aboutAppButton"
              onClick={() => setAboutModalOpen(true)}
              type="button"
            >
              このアプリについて
            </button>
          </div>

          <header className="heroCard heroToolbar">
            <div aria-label="機能切り替え" className="tabGroup" role="tablist">
            <button
              aria-selected={activeTab === "sql-create"}
              className={activeTab === "sql-create" ? "active" : ""}
              onClick={() => setActiveTab("sql-create")}
              role="tab"
              type="button"
            >
              SQL生成
            </button>
            <button
              aria-selected={activeTab === "sql-review"}
              className={activeTab === "sql-review" ? "active" : ""}
              onClick={() => setActiveTab("sql-review")}
              role="tab"
              type="button"
            >
              SQL解析
            </button>
            <button
              aria-selected={activeTab === "table"}
              className={activeTab === "table" ? "active" : ""}
              onClick={() => setActiveTab("table")}
              role="tab"
              type="button"
            >
              テーブル解析
            </button>
            </div>
            <div className="heroProjectSelect">
              <SearchableSelect
                emptyText="対象プロジェクトが見つかりません"
                label="プロジェクト"
                labelPosition="left"
                onChange={setSelectedProject}
                options={projectOptions}
                placeholder="プロジェクトを選択"
                value={selectedProject}
              />
            </div>
          </header>
        </section>
      </div>

      {aboutModalOpen ? (
        <div
          aria-hidden="true"
          className="appModalOverlay"
          onClick={() => setAboutModalOpen(false)}
        >
          <div
            aria-labelledby="about-app-title"
            aria-modal="true"
            className="appModalCard"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="appModalHeader">
              <h2 id="about-app-title">このアプリについて</h2>
              <button
                aria-label="閉じる"
                className="appModalClose"
                onClick={() => setAboutModalOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="appModalBody">
              <section className="appModalSection">
                <h3>注意事項</h3>
                <ul>
                  <li>本アプリは、技術力向上を兼ねて開発している実験的なアプリです。</li>
                  <li>本アプリは、WFSやグループウェアのような、公式の社内フローに即した社内システムではありません。</li>
                  <li>AIによる生成結果には、誤りや不正確な内容が含まれる場合があります。</li>
                  <li>本アプリ内でAIが生成した文言は、会社の公式見解・公式回答ではありません。</li>
                  <li>本アプリは予告なく仕様変更・停止する場合があります。</li>
                </ul>
              </section>

              <section className="appModalSection">
                <h3>利用環境・データの取り扱い</h3>
                <ul>
                  <li>本アプリは、AIモデルを含め、当社契約のAWSアカウント上の環境を利用しています。</li>
                  <li>入力した内容は、外部のAIサービス（OpenAI、Google など）へ送信されません。</li>
                  <li>入力した内容や生成結果が、AIモデルの学習に利用されることはありません。</li>
                </ul>
              </section>

              <section className="appModalSection appModalContact">
                <p>生成AI技術活用研究チーム</p>
                <p>本アプリ開発メイン担当：FS部 東條（m_tojo@jbc.co.jp）</p>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mainStage contentStage">
        <div className="screenContent">
        {activeTab === "sql-create" ? (
          <div className="workGrid fixedHeightGrid">
            <section className="surface surfaceFullHeight">
              <div className="surfaceHeader">
                <div>
                  <h3>SQL生成</h3>
                  <p>{selectedProjectInfo.name} プロジェクト内のテーブルについてSQLを生成します。</p>
                </div>
                <HelpTooltip
                  note="テーブル名やカラム名は、日本語名でも検索できます。"
                  examples={[
                    {
                      label: "単純なSELECT",
                      value: "USERテーブルの全件を取得するSELECT文を書いて",
                    },
                    {
                      label: "並び替えあり",
                      value: "顧客番号と顧客名を顧客番号順で取得するSQLを書いて",
                    },
                    {
                      label: "条件付き検索",
                      value: "注文テーブルから未発送データだけを取得するSQLを書いて",
                    },
                  ]}
                  onSelect={setSqlRequest}
                />
              </div>

              <label className="field">
                <div className="inlineInputShell">
                  <textarea
                    onChange={(event) => setSqlRequest(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void runSqlGenerate();
                      }
                    }}
                    placeholder="例: USERテーブルの全件を取得するSELECT文を書いて"
                    value={sqlRequest}
                  />
                  <button
                    aria-label="SQLを生成"
                    className="sendButton inlineSendButton"
                    disabled={sqlLoading || !sqlRequest.trim()}
                    onClick={() => void runSqlGenerate()}
                    type="button"
                  >
                    <ArrowGlyph />
                  </button>
                </div>
              </label>
            </section>

            <ResponsePanel
              copyValue={sqlResponse}
              description=""
              hideCopy={sqlCreateCopyBlocked}
              loading={sqlLoading}
              loadingLabel="SQLを生成しています..."
              title="生成結果"
              value={sqlResponse}
            />
          </div>
        ) : null}

        {activeTab === "sql-review" ? (
          <div className="workGrid fixedHeightGrid">
            <section className="surface surfaceFullHeight">
              <div className="surfaceHeader">
                <div>
                  <h3>SQL解析</h3>
                  <p>作成したSQLの不具合や改善点について確認できます。</p>
                </div>
                <HelpTooltip
                  examples={[
                    {
                      label: "改善点の確認",
                      value: "このSQLの問題点と改善案を教えて",
                    },
                    {
                      label: "JOIN条件の確認",
                      value: "JOIN条件が正しいか確認して",
                    },
                    {
                      label: "SQL＋エラーの内容",
                      value:
                        "SELECT * FROM user_mst;\n\nSQL0206N \"USER_NAMEE\" is not valid in the context where it is used.",
                    },
                  ]}
                  note="テーブル名やカラム名は、日本語名でも検索できます。"
                  onSelect={setSqlReviewRequest}
                />
              </div>

              <label className="field">
                <div className="inlineInputShell">
                  <textarea
                    onChange={(event) => setSqlReviewRequest(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void runSqlReview();
                      }
                    }}
                    placeholder="例: SQLと実行エラーをそのまま貼り付けてください"
                    value={sqlReviewRequest}
                  />
                  <button
                    aria-label="SQLを解析"
                    className="sendButton inlineSendButton"
                    disabled={sqlReviewLoading || !sqlReviewRequest.trim()}
                    onClick={() => void runSqlReview()}
                    type="button"
                  >
                    <ArrowGlyph />
                  </button>
                </div>
              </label>
            </section>

            <ResponsePanel
              description=""
              loading={sqlReviewLoading}
              loadingLabel="SQLを解析しています..."
              title="解析結果"
              value={sqlReviewResponse}
            />
          </div>
        ) : null}

        {activeTab === "table" ? (
          <div className="tableStackLayout">
            <section
              className={
                tableName
                  ? tableMessages.length > 0
                    ? "surface tableAnalysisSurface tableAnalysisSurfaceExpanded"
                    : "surface tableAnalysisSurface tableAnalysisSurfaceInitial"
                  : "surface tableAnalysisSurface tableAnalysisSurfaceCompact"
              }
            >
              <SearchableSelect
                disabled={tableOptionsLoading || tableOptions.length === 0}
                emptyText={tableOptionsLoading ? "対象テーブルを取得中..." : "対象テーブルが見つかりません"}
                label="対象テーブル名"
                labelPosition="left"
                onChange={setTableName}
                options={tableOptions}
                placeholder={
                  tableOptionsLoading
                    ? "対象テーブルを取得中..."
                    : tableOptions.length === 0
                      ? "対象テーブルがありません"
                      : "テーブル名や論理名で検索"
                }
                value={tableName}
              />
              {tableOptionsError ? <p className="errorText">{tableOptionsError}</p> : null}

              {tableName ? (
                <>
                  <div className="summaryBlock summaryScrollArea">
                    <div className="summaryCopyButton">
                      {!tableSummaryLoading ? <CopyButton label="テーブル要約" value={tableSummary} /> : null}
                    </div>
                    <div className="summaryContentScroll">
                      {tableSummaryLoading ? (
                        <ThinkingIndicator label="テーブル要約を生成しています..." />
                      ) : (
                        <FormattedContent value={tableSummary} />
                      )}
                    </div>
                  </div>

                  {tableSummary && !tableSummaryLoading ? (
                    <div
                      className={
                        tableMessages.length > 0
                          ? "tableAnalysisChatSection tableAnalysisChatSectionExpanded"
                          : "tableAnalysisChatSection tableAnalysisChatSectionCompact"
                      }
                    >
                      <div className="surfaceHeader compactSurfaceHeader">
                        <div>
                          <h3>テーブル解析チャット</h3>
                        </div>
                      </div>
                      <div
                        className={
                          tableMessages.length === 0
                            ? "chatThread markdownChatThread markdownChatThreadEmpty"
                            : "chatThread markdownChatThread"
                        }
                      >
                        {tableMessages.length === 0 ? (
                          <div className="chatEmpty">
                            <div className="chatEmptyExamples">
                              {tableQuestionExamples.map((example) => (
                                <button
                                  className="chatEmptyExampleButton"
                                  key={example}
                                  onClick={() => setTableRequest(example)}
                                  type="button"
                                >
                                  {example}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          tableMessages.map((message) => (
                            <div
                              className={message.role === "user" ? "chatBubble userBubble" : "chatBubble assistantBubble"}
                              key={message.id}
                            >
                              {message.role === "user" ? (
                                <p className="userMessageText">{message.content}</p>
                              ) : (
                                <FormattedContent value={message.content} />
                              )}
                            </div>
                          ))
                        )}
                        {tableQuestionLoading ? (
                          <div className="chatBubble assistantBubble thinkingBubble" aria-live="polite">
                            <ThinkingIndicator label="回答を生成しています..." />
                          </div>
                        ) : null}
                      </div>

                      <div className="chatComposer fixedComposer">
                        <div className="chatInputShell">
                          <textarea
                            disabled={!tableName}
                            onChange={(event) => setTableRequest(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void runTableQuestion();
                              }
                            }}
                            placeholder="このテーブルについて質問してください"
                            value={tableRequest}
                          />
                          <button
                            aria-label="質問を送信"
                            className="sendButton"
                            disabled={tableQuestionLoading || !tableRequest.trim() || !tableName}
                            onClick={() => void runTableQuestion()}
                            type="button"
                          >
                            <SendGlyph />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        ) : null}
        </div>
      </section>
    </main>
  );
}

