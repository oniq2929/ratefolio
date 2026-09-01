// supabase/migrations/0001_init.sql のテーブル定義に対応する型。
// Supabaseプロジェクト作成後、`supabase gen types typescript` で
// 自動生成した型に置き換えることも検討する。

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface Genre {
  id: string
  owner_id: string
  name: string
  /** そのジャンルの評価スケール(何段階評価か。2〜10) */
  scale_max: number
  created_at: string
}

export interface Axis {
  id: string
  genre_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Entry {
  id: string
  owner_id: string
  genre_id: string | null
  /** 作成時点のジャンル名のスナップショット */
  genre_name: string
  /** 作成時点の評価スケールのスナップショット */
  scale_max: number
  target_name: string
  entry_date: string
  /** Supabase Storage上のオブジェクトパス。写真未設定ならnull */
  photo_path: string | null
  comment: string | null
  tags: string[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface EntryScore {
  id: string
  entry_id: string
  axis_id: string | null
  /** 作成時点の評価軸名のスナップショット */
  axis_name: string
  sort_order: number
  score: number
}

export interface Formula {
  id: string
  owner_id: string
  /** 対象ジャンルの名前(axis_nameと同様、名前でマッチングする) */
  genre_name: string
  name: string
  /** 軸名 -> 重み のマップ。例: { "コシ": 3, "出汁": 1, "量": -1 } */
  weights: Record<string, number>
  created_at: string
}
