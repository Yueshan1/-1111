# 提问箱 GitHub Pages 发布目录

这个目录只包含 GitHub Pages 静态网页运行必需文件。

## 可以直接上传的文件

- `index.html`
- `styles.css`
- `app.js`
- `api/`
- `.nojekyll`

## GitHub Pages 设置

1. 新建 GitHub 仓库，例如 `question-box-demo`。
2. 把本目录内容上传到仓库根目录。
3. 进入仓库 `Settings` -> `Pages`。
4. `Build and deployment` 选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. 保存后等待 1-3 分钟。

最终访问链接通常是：

```text
https://你的GitHub用户名.github.io/question-box-demo/
```

## 注意

这是静态演示版，默认使用本地 mock 数据。真实登录、数据库、举报屏蔽、账号删除等能力需要另部署后端服务。
