# Xuxuan Profile — 个人经历展示网站

一个纯静态的个人经历展示网站，支持**站长本人直接在网页里编辑**（增删改事件、上传图片），点「保存并发布」自动提交到 GitHub，由 GitHub Pages 自动重新发布，所有访客约几十秒后可见。

## 技术栈

- 原生 HTML / CSS / JS，零依赖
- 内容数据：`data.json`（运行时读取，编辑时写入）
- 发布：GitHub Contents API
- 测试：Node 内置 `node:test`

## 目录结构

```
index.html        页面结构与渲染逻辑、编辑界面
data.json         内容数据（所有图文）
images/           图片文件
js/
  fallback-data.js   兜底初始数据（data.json 读取失败时使用）
  content.js         数据纯函数（事件 id、增删改、序列化）
  storage.js         数据加载、Token、草稿存取
  image.js           图片压缩、命名、base64
  github.js          GitHub Contents API 客户端
  editor.js          编辑模式与发布流程
scripts/gen-data.cjs 从 fallback-data 重新生成 data.json
test/              单元测试
```

## 如何编辑内容

### 第一步：创建 GitHub Token（只需一次）

1. 登录 [github.com](https://github.com)，点右上角头像 → **Settings**。
2. 左侧拉到最底 → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**。
3. 点 **Generate new token**，填写：
   - **Token name**：随意，如 `xuxuan-profile-editor`
   - **Expiration**：选 90 天（过期后重新生成一把即可）
   - **Repository access**：**Only select repositories** → 只勾选 `yangxuxuan/xuxuan-profile`
   - **Permissions**：找到 **Contents** → 选 **Read and write**
4. 点 **Generate token**，复制那串 `github_pat_` 开头的字符。

> ⚠️ Token 就是你的「钥匙」，能写这个仓库。**不要截图、不要发到群聊或公开地方**。泄露了去 GitHub 撤销重生成即可。

### 第二步：进入编辑模式

1. 打开网站，点**右下角的「✎」小圆点**。
2. 第一次会弹出输入框，粘贴你的 Token，点「解锁」。
3. 解锁后进入编辑模式，底部出现「编辑模式中 · 保存并发布」提示条。

### 第三步：编辑事件

1. 进入「高中」或「大学」，点进某个板块（如「学科竞赛」「志愿者」）。
2. 此时每个事件卡片右上角有「编辑」「删除」，板块顶部有「＋ 新增事件」。
3. 点「编辑 / 新增」，填写：
   - **标题**、**描述**、**备注**（卡片下方小字）
   - **图片**：可上传多张、拖选顺序（第一张为封面）、删除某张
   - **排版**：上图下文 / 左图右文
4. 点「保存」。此时改动只存在你本地，访客看不到。

### 第四步：发布

点底部「**保存并发布**」。网页会把新图片和内容提交到 GitHub，约几十秒～1 分钟后，所有访客刷新就能看到新内容。

## 注意事项

- **图片会被压缩**到最长边 1600px、约 200~500KB（GitHub 接口有 1MB 上限，同时加快网页加载）。存的是压缩版，不是手机原图。
- **未点「保存并发布」前，改动只在你本地**（刷新不丢，存在浏览器草稿里），不影响访客。
- 只有你（持有 Token）能改；访客只能看，看不到编辑入口。
- 兜底：万一 `data.json` 读不到，网站会用内置的初始内容显示，不会白屏。

## 本地预览

```bash
python -m http.server 8765
# 打开 http://127.0.0.1:8765
```

（必须用 http 打开，直接双击 `index.html` 会因浏览器限制读不到 `data.json`。）

## 运行测试

```bash
node --test
```
