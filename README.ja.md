<p align="right">
  <a href="./README.md">English</a> &nbsp;·&nbsp; <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <img src=".github/assets/yodo-labs-logo.png" width="120" alt="Yodo Labs" />
</p>

<h1 align="center">@plateau/r3f</h1>

<p align="center">
  <b>React Three Fiber 向け PLATEAU 3D Tiles ライブラリ</b><br/>
  建物単位の属性カラーリング ・ 5 種の災害レイヤー ・ PMTiles フォールバック
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@plateau/r3f"><img alt="npm" src="https://img.shields.io/npm/v/@plateau/r3f?color=000"/></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-000"/></a>
  <a href="https://github.com/pixelx-jp/plateau-r3f/actions/workflows/ci.yml"><img alt="ci" src="https://github.com/pixelx-jp/plateau-r3f/actions/workflows/ci.yml/badge.svg"/></a>
  <img alt="bundle" src="https://img.shields.io/badge/bundle-~64KB%20ESM-000"/>
  <img alt="tests" src="https://img.shields.io/badge/tests-48%20passing-000"/>
</p>

<p align="center">
  <img src=".github/assets/preview-height-flood.png" width="720" alt="千代田区を高さでカラーリング、洪水ハザードを重ねた表示" />
  <br/>
  <sub>千代田区 — <code>colorBy="height"</code> + <code>&lt;HazardLayer type="river_flood" /&gt;</code></sub>
</p>

---

## なぜ作ったか

[Project PLATEAU](https://www.mlit.go.jp/plateau/) は 25 を超える都市の 3D 都市モデルをオープンデータとして公開していますが、公式ツールは CesiumJS が前提です。本ライブラリは PLATEAU を Three.js / React Three Fiber エコシステムに持ち込み、公式スタックでは標準で得られない 3 つの機能を提供します。

1. **建物単位の属性カラーリング** — `year_built` / `structure` / `height` / 災害深度などからの彩色。
2. **5 種の災害レイヤー** — `river_flood` / `inland_flood` / `tsunami` / `storm_surge` / `landslide`。「データなし」と「調査済み・安全」を正しく区別して合成します。
3. **段階的フォールバック** — 3D Tiles に feature id がない、または属性ファイルの読み込みが失敗した場合、ランタイムが自動的に PMTiles のフットプリント押し出しに切り替え、彩色を維持します。

## インストール

```sh
npm i @plateau/r3f three @react-three/fiber
```

## クイックスタート

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Plateau, HazardLayer } from '@plateau/r3f';

export default function App() {
  return (
    <Canvas camera={{ position: [1500, 1500, 1500], near: 1, far: 1_000_000 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[1000, 2000, 500]} intensity={1} />
      <Plateau
        city="chiyoda"
        baseUrl="https://your-cdn.example.com/plateau"
        colorBy="height"
      >
        <HazardLayer type="river_flood" opacity={0.6} />
      </Plateau>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
```

`baseUrl` は [`plateau-core`](#データパイプライン) が生成したアーティファクトのディレクトリを指します。ランタイムは PLATEAU の CMS には一切アクセスしません。

## ギャラリー

<table>
  <tr>
    <td align="center"><img src=".github/assets/preview-height.png" width="240"/><br/><sub><code>colorBy="height"</code></sub></td>
    <td align="center"><img src=".github/assets/preview-tsunami.png" width="240"/><br/><sub>+ 津波</sub></td>
    <td align="center"><img src=".github/assets/preview-landslide.png" width="240"/><br/><sub>+ 土砂災害</sub></td>
  </tr>
  <tr>
    <td align="center"><img src=".github/assets/preview-minato.png" width="240"/><br/><sub>港区</sub></td>
    <td align="center"><img src=".github/assets/preview-kamakura.png" width="240"/><br/><sub>鎌倉市</sub></td>
    <td align="center"><img src=".github/assets/preview-chiyoda-height-flood.png" width="240"/><br/><sub>千代田区 全景</sub></td>
  </tr>
</table>

## 主な機能

- `<Plateau>` — 3D Tiles と per-tile Arrow 属性テーブルを読み込み、マテリアルの `onBeforeCompile` をパッチして `feature_id` 単位で着色します。
- `<HazardLayer type="...">` — ベースカラーの上にハザード色を重ねます。子要素のマウント順が表示優先度になります。
- `<FootprintLayer>` / `<FallbackExtrusionLayer>` — PMTiles 由来のフットプリント押し出し。ランタイムがフォールバックモードを判断した際に自動マウントされます。
- `<TileDebugLayer>` — タイルのライフサイクル状態を色分けしたワイヤーフレーム表示。
- フック: `useBuilding(key)` / `useBuildings(filter)` / `usePlateauContext()`。
- 拡張ポイント: `ArtifactResolver` / `registerHazardLayer()` / `ShaderExtension` / Worker 経由の Arrow デコーダ。

## データパイプライン

本ライブラリはブラウザ専用のクライアントライブラリであり、**データは同梱しません**。上流の [`plateau-core`](#)（Python）が PLATEAU の CityGML を以下のブラウザ向けアーティファクトに変換します。

```
out_<city>/
  manifest.json
  tile_index.json
  3dtiles/tileset.json
  3dtiles/<z>/<x>/<y>_bldg_Building.glb
  style/<urlencoded(tile_content_uri)>.arrow
  buildings.pmtiles
```

このディレクトリを任意の静的ホスティング（S3 / R2 / GitHub Pages / 自社 CDN 等）に配置し、`<Plateau baseUrl="...">` で指してください。

## 出典 (Attribution)

PLATEAU のデータは **© Project PLATEAU / 国土交通省（MLIT）**、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) で提供されています。本ライブラリを使ったアプリケーションは、このクレジット表示が**必須**です。ランタイムは以下の API を提供します。

```ts
runtime.getAttribution()              // → Attribution[]（dataset_id と source URL）
useBuilding(key)?._attribution        // 建物ごとの出典情報
```

最小限のフッター表示例:

```
© Project PLATEAU / MLIT — CC BY 4.0
```

## ステータス

`0.1.x` — 初回公開リリース。0.2 までは API がパッチリリース内で変更される可能性があります。

| | |
| --- | --- |
| **ユニット + 統合テスト** | 48 件 すべて成功 |
| **複数都市検証** | 千代田 / 港 / 鎌倉 / 福岡 / 名古屋 |
| **ブラウザレンダリング検証** | headless Chromium + WebGL |
| **ビジュアルリグレッション** | ベースライン 3 枚、ピクセル差分 5% 許容 |
| **バンドルサイズ** | ESM 約 64 KB / CJS 約 68 KB / `.d.ts` 約 24 KB |

詳細なガイドと API リファレンスは [`docs/`](./docs/) を参照してください。

## ライセンス

MIT — [LICENSE](./LICENSE) を参照。

PLATEAU データは、データ所有者により別途 CC BY 4.0 ライセンスで提供されています。

---

<p align="center">
  <img src=".github/assets/yodo-labs-logo.png" width="60" alt="Yodo Labs" /><br/>
  <sub><a href="https://yodolabs.jp">Yodo Labs</a> — PixelX Inc.（ピクセルエックス株式会社）が開発</sub><br/>
  <sub>お問い合わせ・パートナーシップ: <a href="mailto:pan@yodolabs.jp">pan@yodolabs.jp</a></sub>
</p>
