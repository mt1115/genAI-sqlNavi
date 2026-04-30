"use client";

import { useMemo, useState } from "react";
import { PROJECTS } from "@/lib/projects";
import { supportsProjectExcel } from "@/lib/admin/project-excel";
import { type NormalizedWorkbook } from "@/lib/admin/types";

type ParseResponse = {
  mapping?: NormalizedWorkbook;
  error?: string;
};

type GenerateResponse = {
  ddl?: string;
  error?: string;
};

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

type OutputPanelProps = {
  title: string;
  description: string;
  value: string;
  placeholder: string;
};

function OutputPanel({ title, description, value, placeholder }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="surface">
      <div className="surfaceHeader">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button
          aria-label={copied ? `${title} copied` : `${title} copy`}
          className={copied ? "copyButton copied" : "copyButton"}
          disabled={!value}
          onClick={handleCopy}
          type="button"
        >
          <CopyGlyph copied={copied} />
        </button>
      </div>
      <textarea className="responseBox adminOutput" placeholder={placeholder} readOnly value={value} />
    </section>
  );
}

export default function AdminPage() {
  const [selectedProject, setSelectedProject] = useState("default");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<NormalizedWorkbook | null>(null);
  const [mappingJson, setMappingJson] = useState("");
  const [ddl, setDdl] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedProjectInfo = useMemo(
    () => PROJECTS.find((project) => project.id === selectedProject) ?? PROJECTS[0],
    [selectedProject],
  );
  const projectSupported = supportsProjectExcel(selectedProject);

  const handleParse = async () => {
    if (!selectedFile) {
      setError("Excelファイルを選択してください。");
      return;
    }

    setParseLoading(true);
    setError("");
    setDdl("");
    setMapping(null);
    setMappingJson("");

    try {
      const formData = new FormData();
      formData.set("projectId", selectedProject);
      formData.set("file", selectedFile);

      const response = await fetch("/api/admin/excel/parse", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ParseResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Excelの正規化に失敗しました。");
      }

      setMapping(data.mapping ?? null);
      setMappingJson(JSON.stringify(data.mapping ?? {}, null, 2));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "予期しないエラーが発生しました。");
    } finally {
      setParseLoading(false);
    }
  };

  const handleGenerateDdl = async () => {
    if (!mapping) {
      setError("先にExcelを正規化してください。");
      return;
    }

    setDdlLoading(true);
    setError("");
    setDdl("");

    try {
      const response = await fetch("/api/admin/ddl/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProject,
          mapping,
        }),
      });

      const data = (await response.json()) as GenerateResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "DDL生成に失敗しました。");
      }

      setDdl(data.ddl ?? "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "予期しないエラーが発生しました。");
    } finally {
      setDdlLoading(false);
    }
  };

  return (
    <main className="appShell">
      <section className="mainStage">
        <header className="heroCard">
          <div className="heroHeader">
            <h1 className="pageTitle">SQLNavi 管理画面</h1>
          </div>
        </header>

        <section className="surface adminSurface">
          <div className="surfaceHeader">
            <div>
              <h3>Excel取り込み</h3>
            </div>
          </div>

          <div className="adminForm">
            <label className="field">
              <span>対象プロジェクト</span>
              <select
                onChange={(event) => {
                  setSelectedProject(event.target.value);
                  setSelectedFile(null);
                  setMapping(null);
                  setMappingJson("");
                  setDdl("");
                  setError("");
                }}
                value={selectedProject}
              >
                {PROJECTS.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Excelファイル</span>
              <label className="filePicker">
                <input
                  accept=".xlsx,.xlsm,.xls"
                  className="fileInput"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <span className="fileButton">ファイルを選択</span>
                <span className={selectedFile ? "fileName selected" : "fileName"}>
                  {selectedFile ? selectedFile.name : "ファイルが選択されていません"}
                </span>
              </label>
            </div>

            {!projectSupported ? (
              <p className="errorText">
                {selectedProjectInfo.name} のExcelパーサは未実装です。プロジェクトごとの列配置に合わせた抽出ロジックを追加する必要があります。
              </p>
            ) : null}

            <div className="actions adminActionRow">
              <button
                disabled={!projectSupported || parseLoading || !selectedFile}
                onClick={handleParse}
                type="button"
              >
                {parseLoading ? "正規化中..." : "Excelを正規化"}
              </button>
              <button
                className="secondaryAction"
                disabled={!projectSupported || ddlLoading || !mapping}
                onClick={handleGenerateDdl}
                type="button"
              >
                {ddlLoading ? "生成中..." : "DDLを生成"}
              </button>
            </div>

            {error ? <p className="errorText">{error}</p> : null}
          </div>
        </section>

        <div className="workGrid">
          <OutputPanel
            description="Excelから抽出した共通JSONです。ここを確認してからDDLを生成します。"
            placeholder="Excelを正規化すると、抽出結果がここに表示されます。"
            title="正規化JSON"
            value={mappingJson}
          />

          <OutputPanel
            description="CREATE TABLE と COMMENT ON TABLE/COLUMN をまとめて出力します。"
            placeholder="正規化後に「DDLを生成」を押すと、論理名コメント付きDDLが表示されます。"
            title="DDL + COMMENT"
            value={ddl}
          />
        </div>
      </section>
    </main>
  );
}
