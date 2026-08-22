export const CATEGORIES = [
  "マークアップ・スタイル",
  "言語・文法",
  "ライブラリ・フレームワーク",
  "ビルド・開発環境",
  "通信・データ",
  "バージョン管理",
  "描画・パフォーマンス",
  "その他",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = [1, 2, 3] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export type Topic = {
  id: string;
  word: string;
  difficulty: Difficulty;
  category: Category;
  relatedWords: string[];
};
