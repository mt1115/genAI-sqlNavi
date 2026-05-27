export type ProjectConfig = {
  id: string;
  name: string;
  description: string;
  kbFile: string;
};

export const PROJECTS: ProjectConfig[] = [
  {
    id: "chugin_smile",
    name: "中銀Smile",
    description: "",
    kbFile: "chugin_smile.txt",
  },
  {
    id: "chugin_biz",
    name: "中銀BizAssist",
    description: "",
    kbFile: "chugin_biz.txt",
  },
  {
    id: "toho_smile",
    name: "東邦Smile",
    description: "",
    kbFile: "toho_smile.txt",
  },
  {
    id: "toho_biz",
    name: "東邦BizAssist",
    description: "",
    kbFile: "toho_biz.txt",
  },
  {
    id: "hokuyo_smile",
    name: "北洋Smile",
    description: "",
    kbFile: "hokuyo_smile.txt",
  },
  {
    id: "hokuyo_biz",
    name: "北洋BizAssist",
    description: "",
    kbFile: "hokuyo_biz.txt",
  },
  {
    id: "default",
    name: "デフォルト（テスト用）",
    description: "",
    kbFile: "default.txt",
  },
];

export function getProjectConfig(projectId?: string | null) {
  return PROJECTS.find((project) => project.id === projectId) ?? PROJECTS[0];
}
