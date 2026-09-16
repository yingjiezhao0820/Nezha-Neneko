# Nezha-Neneko

[![Build and Release Theme](https://github.com/yingjiezhao0820/nezha-BITJEBE/actions/workflows/release.yml/badge.svg)](https://github.com/yingjiezhao0820/nezha-BITJEBE/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/yingjiezhao0820/nezha-BITJEBE)](https://github.com/yingjiezhao0820/nezha-BITJEBE/releases)
[![License](https://img.shields.io/github/license/yingjiezhao0820/nezha-BITJEBE)](./LICENSE)

一个面向 [Komari Monitor](https://github.com/komari-monitor/komari) 的响应式监控主题。本仓库在上游主题基础上持续维护，重点改进首页性能、服务器详情、资产统计、流量展示和可配置毛玻璃视觉。

> 当前文档、构建产物和 Release 均以本仓库为准。

![主题预览](./preview.png)

## 主要功能

### 首页与服务器卡片

- 节点元数据与实时状态并行加载，减少首页等待时间。
- 支持标准卡片和紧凑行内卡片布局。
- CPU、内存、存储、流量和网速指标统一展示。
- 支持服务器分组、自定义分组顺序、排序、全球地图和服务监控。
- 支持流量使用进度、重置倒计时和计费方式。
- 支持服务器线路、带宽、IP 和自定义标签。

### 服务器详情

- 展示系统、CPU、内存、存储、负载、进程、实时网速和连接数。
- 可通过 `ShowServerDetailAssets` 开启资产与流量区域，展示资费、Traffic 使用进度、剩余价值、剩余天数和到期时间，并可直接打开当前服务器的资费计算弹窗。
- 检测点表格支持单选、多选、取消选择以及综合延迟曲线。
- 首页与详情页共用导航、时钟和背景体验，路由切换更连贯。

### 资产统计

- 汇总服务器数量、总价值、月均/年均支出及剩余价值。
- 支持 CNY、USD、HKD、EUR、GBP 和 JPY。
- 支持按服务器覆盖账单币种和资产卡片临时切换币种。
- 支持服务器交易金额计算和 Markdown 一键复制。
- 资产统计面板和交易弹窗拥有独立的颜色与透明度设置。

### 外观与国际化

- 首页卡片、详情卡片和资产面板采用统一毛玻璃风格。
- 可配置卡片颜色、背景透明度、桌面/移动端背景和站点 Logo。
- 支持亮色、暗色及跟随系统模式。
- 支持简体中文、繁体中文、英文、德文、西班牙文、俄文和泰米尔文。

## 安装

### 从 Release 安装

1. 前往本仓库的 [Releases](https://github.com/yingjiezhao0820/nezha-BITJEBE/releases/latest) 下载最新主题 ZIP。
2. 进入 Komari 管理面板的主题管理页面。
3. 上传 ZIP，并将该主题设置为当前主题。

请直接使用 Release 中生成的主题包。ZIP 根目录应保持以下结构：

```text
komari-theme.json
preview.png
dist/
├── index.html
└── assets/
```

如果 ZIP 中只有构建文件而没有 `dist/index.html`，Komari 将无法正确识别主题。

### 从源码构建

建议使用 Node.js 22 和 npm。

```bash
git clone https://github.com/yingjiezhao0820/nezha-BITJEBE.git
cd nezha-BITJEBE
npm ci
npm run build
```

构建结果位于 `dist/`。手动制作主题包时，请将 `komari-theme.json`、`preview.png` 和完整的 `dist/` 目录放在 ZIP 根目录。

## 常用主题设置

所有设置均可在 Komari 主题配置页面中修改。

| 配置项 | 作用 |
| --- | --- |
| `CustomBackgroundImage` | 设置桌面端背景图片 |
| `CustomMobileBackgroundImage` | 设置移动端独立背景图片 |
| `CustomLogo` | 设置站点 Logo 和浏览器图标 |
| `ForceTheme` | 强制亮色、暗色或跟随系统 |
| `CardGlassColor` | 设置通用毛玻璃卡片颜色 |
| `CardGlassOpacity` | 设置首页和详情卡片背景透明度 |
| `EnableServerCardHoverAnimation` | 开启首页服务器卡片浮起、缩放和阴影动画，默认关闭 |
| `ShowGroupBar` | 控制首页地图、服务、布局、分组和排序整栏 |
| `ForceCardInline` | 启用紧凑行内卡片布局 |
| `ShowServerTags` | 显示或隐藏服务器可见标签 |
| `ShowTrafficBar` | 显示服务器卡片流量进度条 |
| `TrafficBarInMetricRow` | 将流量进度嵌入指标栏，并合并上传/下载为网速 |
| `TrafficResetDayOverrides` | 按 UUID、服务器 ID 或名称覆盖流量重置日 |
| `ShowAssetCard` | 启用资产统计入口和面板 |
| `ShowServerDetailAssets` | 显示详情页资产与流量区域，默认关闭 |
| `AssetCardDefaultCurrency` | 设置资产统计默认币种 |
| `AssetCardOpacity` | 单独设置资产面板和交易弹窗透明度 |
| `DefaultBillingCurrency` | 设置默认账单币种或跟随后端 |
| `ServerBillingCurrencyOverrides` | 按服务器覆盖账单币种 |
| `ForcePeakCutEnabled` | 裁剪网络图表异常峰值，提高可读性 |
| `ServerDetailMonitorHours` | 设置详情页检测图表时间范围，默认 24 小时 |

其余选项及帮助文本请参阅 [`komari-theme.json`](./komari-theme.json)。

## 节点标签元数据

主题会解析 Komari 节点的 `tags` 字段。多个标签使用分号 `;` 分隔。

```text
So-net<red>;1Gbps<green>;<HKD>;<TRD:1>;<TAG:TW>
```

| 格式 | 说明 |
| --- | --- |
| `So-net<red>` | 为可见标签指定颜色 |
| `<HKD>` | 覆盖该服务器的账单币种 |
| `<TRD:1>` | 设置每月第 1 天为流量重置日 |
| `<TAG:TW>` | 使用两位国家或地区代码覆盖国旗和地图地区 |

元数据标签不会作为普通标签显示。`<TAG:TW>` 等国旗覆盖也不受 `ShowServerTags` 开关影响。

支持的账单币种包括：`CNY`、`JPY`、`USD`、`EUR`、`GBP`、`HKD`、`TWD`、`KRW`、`SGD`、`CAD` 和 `AUD`。

## 流量与账单数据

流量进度使用 Komari 节点中的以下字段：

- `traffic_limit`：流量上限，单位为字节。
- `traffic_limit_type`：支持 `sum`、`max`、`min`、`up` 和 `down`。
- 流量重置日通过 `<TRD:n>` 或主题配置 `TrafficResetDayOverrides` 设置。

账单价格、计费周期和 `expired_at` 用于计算剩余价值及到期状态。`expired_at` 不是流量重置日期。

## 本地开发

```bash
npm ci
npm run dev
```

常用命令：

```bash
npm run lint       # ESLint 检查
npm run build      # TypeScript 检查并构建生产文件
npm run preview    # 本地预览生产构建
npm run format     # 使用 Prettier 格式化代码
```

## 自动发布

推送版本标签后，GitHub Actions 会自动：

1. 根据标签更新主题版本号。
2. 安装依赖并构建项目。
3. 校验主题清单和主题包目录结构。
4. 生成 `Nezha-Neneko-<tag>.zip`。
5. 创建或更新 GitHub Release 并上传主题包。

示例：

```bash
git tag v1.1.8
git push origin v1.1.8
```

也可以在 GitHub Actions 页面手动运行 `Build and Release Theme` 工作流。

## 技术栈

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 3
- TanStack React Query
- Recharts
- Framer Motion
- i18next

## 致谢

本项目基于以下开源项目和社区工作继续开发：

- [Komari Monitor](https://github.com/komari-monitor/komari)
- [Akizon77/nezha-dash-v1](https://github.com/Akizon77/nezha-dash-v1)
- [BITJEBE/nezha-BITJEBE](https://github.com/BITJEBE/nezha-BITJEBE)

## 许可证

本项目基于 [Apache License 2.0](./LICENSE) 发布。
