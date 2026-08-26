# dsh-ui-liquid-glass

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 的第三方 UI 主题插件。液态玻璃主题：一层别名 token 覆盖，把 dsh web 界面变成铺在插件壁纸上的半透明玻璃配色；[liquidGL](https://liquidgl.naughtyduk.com)（npm 包 `liquid-gl`）WebGL 折射直接作用在会话输入框卡片上；随会话滚动联动的壁纸；一个角落按钮；以及设置页"插件"节里的一张卡片，承载同一开关、壁纸选择与自定义图片的纱强度——开关、预设 id 与纱强度持久化到 Host 设置文档，自定义上传的图片持久化到浏览器本地 IndexedDB。壁纸有两个内置预设——`ridge`，高对比线稿场景（给折射提供可弯折的结构，集中在输入框身后），以及 `collage`，原始渐变拼贴——外加用户上传的图片；内置预设长按角落按钮循环切换或在设置卡片里选取。

## 安装

需要可运行的 `dsh web`（针对 dsh `0.1.1-rc.2` 开发）。把包装进 profile 并注册一行 insert：

```sh
dsh plugin --profile web add file:/path/to/this/repo        # 发布后也可以用 npm spec
```

再在 `$DSH_HOME/profiles/web/cordis.patch.yml` 里加：

```yaml
- insert:
    - id: dsh-ui-liquid-glass
      name: dsh-ui-liquid-glass
```

重启 `dsh web`，右下角出现水滴按钮；开关、预设、纱强度与通透度的选择都会持久化到 Host 设置。

## 开发

```sh
pnpm install
pnpm run typecheck   # @deepseek-ai/* 走 npm 已发布类型的解析
pnpm run test        # vitest；需要在 ../deepseek-harness 有 deepseek-harness 克隆
pnpm run build       # tsc 产物 + tsdown → lib/index.js, lib/client.js
pnpm run watch
```

已发布的 `@deepseek-ai/dsh-client-*` 产物是面向 dsh 模块加载器的闭包格式，vitest 无法直接导入，所以测试链路把这类包重定向到旁边 deepseek-harness 克隆的源码平面（`git clone https://github.com/deepseek-ai/deepseek-harness ../deepseek-harness`）——与仓库内开发遵守同一条源码平面规则。typecheck 与构建保持独立，只依赖 npm 类型。探测运行中的服务器前先重新构建（`pnpm run build`）：注册表服务的是 `lib/client.js`，不是源码。

## 设计

token 层通过 [`ctx.theme.overrideTokens`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-theme/README.zh.md) 以本包 id 注册，叠加在用户当前的基础配色（`light`/`dark`/`system`）之上；插件卸载或开关关闭时完全消失。表面（层级面板、气泡、代码块、菜单、输入框）变为半透明；文本、状态色、遮罩和滚动条保持基础配色。侧栏是**磨砂**而非发白：fill token 保持很弱（0.18/0.25），controller 经 ui-layout 暴露的 `data-app-sidebar` 标记给侧栏列加背景模糊，壁纸在会话文字背后读成柔和的色晕，而不是白纱下清晰的噪点——早先 0.34 的 fill 叠上 frame 的半透明 `bg-base` 会合成 ~0.55 的白纱，把整列洗白。弹窗面板走共享的 `data-modal-panel` 标记拿到同一配方（ui-primitives 的对话框卡片与设置壳面板都带此标记）：半透明的 layer-2 填充罩在密排文字上，只有背景糊成色晕后才可读。设置对话框是例外：保留磨砂，但恢复不透明填充（`[role=dialog][aria-modal=true]`），这样全局通透度滑杆不会把会话文字打穿一块阅读表面。完整取值见 `src/tokens.ts`。

折射目标是应用自有的输入框卡片（`data-composer-card`），不是插件自有的面板：库把卡片的填充以内联样式剥掉，把折射玻璃画在它共享的 body 级镜头画布上，而 composer 座位的层叠上下文（停靠相位是 sticky + `z-index` 7；hero 与 settling 相位由插件注入的规则垫高）保证每个字形和控件都在画布之上。调参对齐库的 demo-5 观感——中心微折射、深而窄的斜边、无磨砂，以及库的投影；投影以画布旁的 fixed 元素加卡片内联阴影的形式存在，开关切换时由插件重新驱动。快照源是插件壁纸——从不截取应用 DOM——且特意用 `position: absolute`：快照栅格化会跳过 fixed 定位元素（包括作为根传入的元素），而文档从不滚动，absolute 的绘制结果完全一致。卡片在启动之后才挂载，因此 controller 用 MutationObserver 等它出现，并在卡片重挂载后重新玻璃化。WebGL 不可用时由库自身把目标退化为 CSS `backdrop-filter` 磨砂。角落按钮（右下角）切换整个主题，关闭后它仍是重新开启的入口。

壁纸通过一个挂在 document 上的捕获阶段监听器跟随会话滚动容器（`data-conversation-scroll`）：以固定 0.25 视差系数映射滚动距离，每次开启后在第一次观测到的滚动位置取锚点，并把位移钳制在 ±60vh 余量内（壁纸元素相应加高），因此无论用户停在会话多深处，位移都有界。加高后的画布包在一个视口大小的裁剪容器（`overflow: hidden`）里——不裁剪的话，比视口高出 60vh 的绝对定位盒子会把文档可滚动区撑大一个余量，整个应用都能被往下拽，而应用的布局前提是文档永不滚动。玻璃在滚动时**无需重拍快照**：栅格化把纹理烘焙在壁纸自身坐标系里（对元素当前变换求逆），而镜头每帧都从活的快照矩形重算采样区，位移会被自动跟踪——交互中途重拍只会白白重新栅格化全分辨率纹理。预设切换会克隆即将离场的一层、在其下绘制新画面，并以 150ms 淡出（`prefers-reduced-motion: reduce` 跳过淡出）；唯一的一次重拍等克隆离场后再发生，镜头与壁纸一起落定（尺寸变化仍归库的 ResizeObserver 管）。亮暗切换是另一次重拍：`theme/change` 等两帧让 `:global(body[data-ds-dark-theme])` 壁纸规则画完，再重拍，输入框不会继续折射上一套配色。壁纸是合成层（`will-change: transform`），逐滚动帧的 transform 写入因此不会重绘 220vh 高的渐变画布。会话内部的嵌套滚动区（代码块）与无关滚动区（侧栏列表）不会带动壁纸——监听器对滚动容器做精确匹配。

偏好持久化在本插件自己的 Host 设置命名空间里，而不是浏览器：Node 半区声明 `Config`（`enabled` + `preset` + `veil` + `clarity` 以及 liquidGL 观感旋钮）并经 `installSettingsSection` 注册，浏览器半区经 `ctx.settingsScope` 读写同一命名空间——选择跨浏览器、跨设备保持一致，而引导行依旧不携带配置（web 启动路径只按名字组装浏览器条目）。设置页"插件"节的卡片是该命名空间之上的浏览器侧编辑器，以 `settings.plugin.item` 按命名空间键控注册；controller 经 inject hooks 舱位里的快照 store 发布 `{ enabled, preset, custom, veil, clarity, look, lookValues }`，水滴点击、长按循环与设置写入都从同一来源渲染。输入框玻璃观感是三套命名标定（`restrained` / `standard` / `rich`——`rich` 是出厂标定），放在设置页；同一套旋钮在水滴右键弹出的微调面板上，拖的时候输入框还看得见。选档位复制整袋参数，拖滑杆则派生为 `custom`。数值 uniform 每帧从 `lens.options` 读取；热路径里库唯一要走的 setter 是 `setShadow`。自定义图片的纱强度是卡片里的一个滑杆（仅自定义预设激活时显示）：其渐变各档 alpha 按 controller 驱动的 `--dsh-liquid-glass-veil`（0–1）缩放，0 显示原图，默认 100 是出厂标定；表面随每次输入事件即时生效，Host 文档写入拖尾于手势（250ms 防抖），一次拖动只提交一次。表面通透度是第二个常驻滑杆：[`scaleSurfaceTokens`](src/tokens.ts) 在出厂标定（0）与全透终点（100）之间对整张覆盖表插值——静态表面填充淡出到完全透明，交互态与瞬态填充淡出到可用底限，边框、对比按钮与彩色强调保持出厂值（它们是玻璃的边和反馈，不是色罩）；通透度变化会销毁插件先前的覆盖层并注册缩放后的新层。上传的图片本身不经过 Host——图片是设备本地的 IndexedDB blob，命名空间里只存 `custom` 这个 id；同一 Host 的其他浏览器在内置场景上渲染，直到它也上传自己的图片。

## Model Experience

无；本包只做浏览器呈现，不参与任何模型请求。

#### KV Cache effect

无；本包不组装也不发送 provider 请求。

## Known Limitations and Deferred Work

- **liquidGL 没有移除 lens 和卸载的 API** —— 关闭时隐藏 renderer 画布并停掉 rAF 循环，卡片填充以内联样式还原；window 级全局 renderer 与已创建的 lens 实例按库设计在插件卸载后继续存在。
- **重挂载的输入框卡片会拿到新 lens** —— 库无法解绑旧 lens，孤儿实例留在已脱离的节点上（在那里什么也不画）；反复切换工作区会积累休眠 lens。
- **Safari 在宽玻璃上不稳定** —— 库文档说明液态元素超过视口宽度约 50% 时可能不稳定，而输入框在窄窗口下经常超过。
- **视差让超大 GPU 表面常驻** —— `will-change: transform` 背后的合成层与快照纹理都覆盖视口加 120vh 余量（纹理按 2 倍分辨率栅格化），开关开启期间是一笔持续的 GPU 显存开销。
- **侧栏磨砂在每次视差帧都会重算** —— 壁纸的滚动位移让侧栏列 `backdrop-filter` 的背景持续移动，滚动时要为单列模糊付出每帧重算的代价；桌面 GPU 上未实测出问题，但这是本插件独有的滚动路径成本。
- **后注册的 `overrideTokens` 层会替换表面取值** —— 覆盖栈按 seq 排序，后注册的插件逐 token 获胜；本插件不做防御。
