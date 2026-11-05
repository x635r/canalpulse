# CanalPulse · 全球咽喉海峡与航运走廊全景

CanalPulse 是一个面向全球关键海运咽喉的态势仪表盘原型：把 **运河/海峡、锚地压港、吃水富裕水深（UKC）与历史封锁推演** 放进同一张可交互的海图操作台。

支持八个节点：

| 节点 | 类型 | 本次界面的核心读数 |
| --- | --- | --- |
| 苏伊士运河 | 海平面运河 / 编队通行 | 队列 47 · 平均等待 19.4h · 控制深度 24.0m |
| 巴拿马运河 | 船闸运河 / Neopanamax | 队列 37 · 平均等待 27.8h · 控制深度 18.3m |
| 马六甲海峡 | 双向 TSS / 深水航道 | 队列 63 · 平均等待 6.9h · 控制深度 25.0m |
| 博斯普鲁斯海峡 | 单向窄水道 / 引航编队 | 队列 18 · 平均等待 11.6h · 控制深度 32.0m |
| 霍尔木兹海峡 | TSS 咽喉 / 双向航道 | 队列 54 · 平均等待 16.2h · 控制深度 27.0m |
| 直布罗陀海峡 | TSS 航道 / Camarinal 海槛 | 队列 38 · 平均等待 5.4h · 控制深度 30.0m |
| 曼德海峡 | 狭窄咽喉 / 护航编队 | 队列 41 · 平均等待 13.8h · 控制深度 26.0m |
| 多佛海峡 | TSS 航道 / 高密度 | 队列 27 · 平均等待 4.1h · 控制深度 21.0m |

> 当前 AIS 船位为确定性情景回放，锚地与队列细节为可交互沙盒数据；水深 WMS、气象与底图是公开实时服务。所有功能均不用于真实航行。

## 运行

```bash
npm install
npm run dev
npm run build
npm run preview
```

技术栈：React 19 + TypeScript 7 + Vite 8 + MapLibre GL JS 6。生产构建会自动把 MapLibre worker 拆成独立资源；这里通过 `?worker&url` + `setWorkerUrl()` 解决 bundler 下的 MapLibre 6 worker 路径问题。

### 测试

```bash
npm test          # vitest run，19 个用例
npm run test:watch
```

覆盖 NDBC 定宽报文解析、haversine/航段插值、方位角与边界钳制。

### 部署（Cloudflare Pages）

线上地址：<https://canalpulse.pages.dev>

```bash
npm run build      # tsc -b && vite build
npm run deploy     # wrangler pages deploy dist --project-name=canalpulse
```

配置见 `wrangler.jsonc`（`pages_build_output_dir: dist`）。`public/_headers` 为哈希资源设置一年不可变缓存，HTML 外壳保持不缓存，避免发版后卡在旧版本。

若需预览环境：

```bash
npm run deploy:preview   # 部署到 preview 分支
```

## 核心交互

- **四节点切换**：苏伊士、巴拿马、马六甲、博斯普鲁斯，地图会自动拟合真实水道、航路与锚地包络。
- **海图为主体**：地图占据整个中栏（下方编队沙盒默认收起，按 `CONVOY SANDBOX` 展开），苏伊士运河中心线直接取自 OSM 水道几何（way 5038117 / 925360882），放大后航线与真实河岸重合。
- **FLOW 通航态势**：船型着色、经过路点、实时矢量海图、锚地包络、编队方向箭头与 AIS 回放船位。叠加 OpenSeaMap 航海符号（浮标、灯标、分隔带），z10 以上可见。
- **BATHY 水深等深线**：按节点叠加对应水深 WMS，并联动右侧吃水剖面与 UKC 安全判定。苏伊士与博斯普鲁斯使用 EMODnet（欧洲海域覆盖更细），巴拿马与马六甲使用 GEBCO 全球网格；GEBCO 图层做了去饱和处理以适配深色海图。图例刻度取自各节点的实际等深线序列。
- **QUEUE 锚地压港**：按等待时长对锚地船位做热力聚集，右侧矩阵按船型 × 等待区间拆分。
- **RECON 封锁推演**：长赐号 2021 年搁浅时间轴回放，重放封航 → 清淤 → 脱浅 → 复航 → 清队全过程；地图上的滞留船舶圈层与底部积压曲线同步。
- **CONVOY SANDBOX**：南北/东西双向编队，速度倍率、暂停、重置、注入船舶；苏伊士/马六甲显示海平面通过结点，巴拿马显示船闸，博斯普鲁斯显示单向编队。
- **VESSEL DETAIL**：点选任一船舶，地图左上出现该船详情卡（船型、IMO/MMSI、实时经纬度、SOG、航向、吃水、LOA/梁宽、DWT、起讫港、所属锚地），可用 `‹ ›` 轮换船舶，卡片可折叠以免遮挡航道。
- **CHART PROBE**：选择任一锚泊船，拖动吃水滑杆，实时计算 `UKC = 控制水深 + 潮位 − 吃水 − 下蹲量`，输出 SAFE / CAUTION / NO-GO。
- **动态比例尺**：右下角比例尺按当前纬度和缩放实时换算，以海里/米为单位（如 `1.0 NM`），并显示当前中心经纬度与 Z 级别。
- **WORLD 全球海图**：按 `5` 切换到全球总览，八个咽喉节点一次性显示在地图上（含中文名与当前队列数），点击任一节点标记即下钻到该节点的作业视图。
- **LIVE AIS 实时船舶**：右上角 `LIVE AIS` 开关接入 Digitraffic 开放 AIS，实时拉取波罗的海约 950 艘真实船舶（含船名、船型、吃水、目的港），按船型着色渲染，每 60 秒自动刷新。
- **SOURCE MATRIX**：可追溯至数据源，并列出本原型的数据模型边界。

### 快捷键

- `1` / `2` / `3` / `4`：切换 FLOW / BATHY / QUEUE / RECON 四个视图；在输入控件中获得焦点时自动忽略。
- 地图交互：拖动/缩放/重定位；右侧 `VOYAGE` 箭头可轮换待选船舶。
- 浏览器宽度低于 1120px 时自动切换为移动布局，保留全部关键视图。

## 数据源

| 来源 | 用途 | 状态 |
| --- | --- | --- |
| [EMODnet Bathymetry WMS](https://emodnet.ec.europa.eu/en/bathymetry) | 欧洲海域水深色带（苏伊士、博斯普鲁斯） | 实时 WMS |
| [GEBCO 2026 Grid / WMS](https://www.gebco.net/data-products/gebco-web-services) | 全球海深基准（巴拿马、马六甲） | 实时 WMS |
| [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) | 浪高、浪向、周期、海流 | 实时 API |
| [Open-Meteo Forecast](https://open-meteo.com/en/docs) | 风向、风速、能见度、气温 | 实时 API |
| [OpenFreeMap](https://openfreemap.org/) / OpenStreetMap | 自定义海图矢量底图 | 实时矢量瓦片 |
| [OpenSeaMap](https://www.openseamap.org/) | 浮标、灯标、TSS 分隔带等航海符号 | 实时瓦片 (z10+) |
| [OSM Way 5038117](https://www.openstreetmap.org/way/5038117) | 苏伊士运河航道中心线几何 | 已固化到数据文件 |
| [OSM Way 179053882](https://www.openstreetmap.org/way/179053882) | 巴拿马运河航道中心线几何 | 已固化到数据文件 |
| [Digitraffic AIS](https://www.digitraffic.fi/en/meriliikenne/) | 波罗的海实时船舶位置与静态数据 | 实时 API（无需密钥） |
| [AISHub](https://www.aishub.net/api) | 船位 AIS 原始报文 | 需凭证，服务端代理 |
| [MarineTraffic API](https://servicedocs.marinetraffic.com/) | 船位 / 港口事件 | 需凭证，服务端代理 |
| [VesselFinder API](https://api.vesselfinder.com/docs/) | 船位 / 静态资料 | 需凭证，服务端代理 |
| [IMF PortWatch](https://portwatch.imf.org/) | 咽喉年度通行量与船型构成（**已接入**，主流量的真实来源） | 实时 API |
| [Suez Canal Authority](https://www.suezcanal.gov.eg/English/Pages/default.aspx) | 编队、吃水限制、官方通告 | 参考数据 |
| [Panama Canal Authority](https://www.pancanal.com/) | 船闸计划、加通湖水位 | 参考数据 |

### 为什么默认是 AIS Replay

AISHub、MarineTraffic、VesselFinder 都需要注册凭证，且生产环境不应把凭证放进浏览器。这个原型用确定性种子生成四组可交互的 AIS 船位、等待分布与船队编成，保证**无凭证也能完整演示所有交互**。地图上可见的等待热区、队列和编队位置在这些固定锚地/航路包络内生成，并非真实 AIS 跟踪。

## 接入实时 AIS

`src/data/aisAdapter.ts` 已提供标准化入口。建议让一个服务端/边缘函数保存凭证，并对浏览器暴露统一接口：

```text
GET {VITE_AIS_PROXY_URL}/chokepoints/:id/vessels
Accept: application/json
```

返回：

```json
{
  "fetchedAt": "2026-10-31T17:00:00Z",
  "vessels": [
    {
      "mmsi": 636092123,
      "imo": 9811000,
      "name": "EXAMPLE STAR",
      "latitude": 30.45,
      "longitude": 32.32,
      "sog": 8.2,
      "cog": 162,
      "heading": 161,
      "draught": 14.5,
      "length": 366,
      "beam": 51,
      "shipType": 71,
      "destination": "SINGAPORE",
      "navigationStatus": 0,
      "lastSeen": "2026-10-31T16:58:31Z"
    }
  ]
}
```

代理层应完成：

1. 凭证注入与限流（不要把 API key 下发到前端）。
2. 将 AISHub XML 或 VesselFinder JSON 映射到上面的规范结构。
3. 按咽喉 AOI 过滤、剔除异常坐标、补全船型。
4. 为船位增加与锚地 geofence 的匹配结果，再送入 UI。

在 `App.tsx` 中可将确定性的 `generateFleet(chokepoint)` 替换为 `fetchAisSnapshot()` + `normalizeAisFleet()` 返回的船队；队列热力、右侧统计与历史回放保持独立即可。接入实时数据后，请同步更新左侧和右侧的聚合统计，而不是只替换地图点位。

## 数据模型说明

- **等待矩阵**：船型 × 等待区间（0–6h、6–12h、12–24h、24h+）的船数矩阵，用于右侧热力表。
- **UKC**：`控制水深 + 潮位 − 静态吃水 − 下蹲量`。苏伊士采用 24.0m 控制水深与 20.1m 授权吃水；巴拿马采用 18.3m / 15.24m（Neopanamax）的口径；数值用于演示安全判定，不构成航行建议。
- **历史封锁**：长赐号 2021-03-23 07:40 埃及时间在 km 151 搁浅，2021-03-29 脱浅，6 天 7 小时后恢复。回放时间轴按 23 MAR–04 APR 的 13 个积压日序列插值，队列数峰值 369。
- **沙盒船舶**：可视化船是确定性生成的演示船队；船名、呼号、IMO 只用于界面展示，勿与真实航行或商业决策关联。

历史事实参考：[Reuters 时间线](https://www.reuters.com/graphics/EGYPT-SUEZCANAL/SHIP/jznvngokdpl)、[Suez Canal Authority 脱浅通告](https://www.suezcanal.gov.eg/English/MediaCenter/News/Pages/nav_29-03-2021.aspx)。

## 项目结构

```text
src/
  data/
    chokepoints.ts   四个咽喉的水道、锚地、队列、深度与气象坐标
    fleet.ts         船型、命名池与确定性船队生成器
    blockade.ts      长赐号事件时间轴与积压序列
    aisAdapter.ts    可接入实时 AIS 代理的 schema + 归一化
  lib/
    mapStyle.ts      CanalPulse 专用深色航海图样式
    geo.ts           航线插值、方位、圆域与格式工具
    blockade.ts      封锁回放的时间与阶段映射
    useWeather.ts    Open-Meteo 实时气象
  components/
    ChartStage.tsx   海图容器、模式切换与 HUD
    MapCanvas.tsx    MapLibre、WMS、AIS 标绘和封锁图层
    ConvoyDock.tsx   编队过闸沙盒
    BlockadeReplay.tsx 历史封锁回放
    RightRail.tsx    压港矩阵、吃水剖面、封锁档案
    SourcesDrawer.tsx 数据来源与方法说明
  styles/            分层的视觉系统：base / stage / map / panels / responsive
```

## 已知边界

- MapLibre 6 需要 WebGL2；无 WebGL2 时会显示备用海图底纹。
- **航道几何精度**：苏伊士与巴拿马运河的中心线已替换为 OSM 实测水道几何（分别为 40 / 44 个节点），放大后与真实河岸重合。马六甲、博斯普鲁斯、霍尔木兹、直布罗陀、曼德、多佛仍为手工控制点近似，在 z12 以上放大时可能与真实水道有偏差。
- **核心流量的数据来源**：八个咽喉的年通行量、日均通行、船型构成均来自 IMF PortWatch（ArcGIS FeatureServer）。`IN WATERWAY` 是由通行量与过境时长推导的估算值，界面标注 EST；实测值带绿点标记。
- **实时 AIS 覆盖范围**：免费且支持浏览器直接访问的公开 AIS 源目前只有 Digitraffic（波罗的海）。AISHub / MarineTraffic / VesselFinder 均需凭证，因此全球实时船位需自建服务端代理，见「接入实时 AIS」一节。全球海图视图本身展示的是八个咽喉的态势数据，不是全球实时船位。
- **OpenSeaMap 在 z10 以下不渲染**：其低缩放瓦片是整片紫红区域填充而非点状航海符号，会污染海图，因此限定 z10 起显示。
- EMODnet WMS 只覆盖欧洲海域（含地中海与黑海），因此苏伊士与博斯普鲁斯用它；巴拿马与马六甲改用 GEBCO 全球网格，否则 BATHY 图层会是完全空白的。
- 两个 WMS 的可用性取决于网络与 CORS，断网时仍保留深色底图与本地几何图层。
- 海上气象模型对部分内海/运河入口可能没有格点，界面会回落到本地的示意气象值，并标记 `MODEL`。
- 项目当前未附带 AIS 服务端代理；商业 AIS 数据需自行申请并遵守供应商条款。
- 本项目是态势与推演 UI，不提供航海计划、潮汐表或引航建议。
