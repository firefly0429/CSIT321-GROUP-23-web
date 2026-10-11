# CSIT321 — Industrial Safety Training

本版本补齐网站端训练流程、Unity 通信接入代码、Supabase 认证及数据库保存。**它不是已经完成头显验收的 WebXR 构建。** `public/unity/Build/` 保留原上传的编译文件；必须在原 Unity 工程导入脚本、连接实际任务及 WebXR 后重新导出。

## 先运行网站

建议 Node.js 24.15+（或 22.22.2+ 的 Node 22 系列；测试依赖要求这些版本）。在项目根目录执行：

```sh
npm ci
npm run dev
```

打开终端显示的地址。选择 **Trainee demo → Start Training → Ladder Inspection → Browser workflow demo → Open Training**。点击 Start training，按顺序完成五项任务，即可查看 Feedback / History。任务数据标为 Demo，不能作为真实 VR 操作证明。

```sh
npm test       # 状态、协议、数据库权限、React Demo 流程
npm run lint
npm run build
npm run preview
```

## 已补齐的文件与能力

| 部分 | 文件 | 行为 |
| --- | --- | --- |
| 消息协议 | `src/types/unityMessages.ts` | 版本、事件类型、字段校验 |
| 双向通信 | `src/services/unityBridge.ts` | 校验 origin 和 iframe Window；命令确认、超时重试 |
| Unity 播放器 | `src/components/training/UnityPlayer.tsx` | 加载状态、桥接状态、场景匹配、不可恢复进度提示 |
| 训练页面 | `src/pages/TrainingPage.tsx` | 真实 Unity 事件模式与明确标识的网页 Demo；暂停、重启、退出 |
| 状态与计分 | `src/services/trainingState.ts`、`src/store/useTrainingStore.ts` | 按顺序完成、重复事件去重、错误扣分、暂停计时、结束时长 |
| 本地持久化 | `src/services/sessionRepository.ts` | 按账号隔离、同一 JSON 写入会话和待同步队列、保存失败明确报错 |
| 登录与云端 API | `src/services/authService.ts`、`trainingApi.ts` | 注册、登录、SDK token 刷新、查询、事务 RPC 保存 |
| 同步反馈 | `src/components/common/SyncStatus.tsx` | 本地/同步中/已同步/失败状态，重试；联网恢复及定时重试 |
| Unity 接入 | `unity-integration/Assets/` | C# 管理器、顺序评分、场景适配器、`.jslib` |
| 数据库 | `supabase/migrations/202610110001_training.sql` | 表、RLS、身份自动建立、授权教师查询、原子保存和服务端重新计分 |
| 部署 | `public/_headers`、`_redirects`、`vercel.json` | 常见静态平台的 SPA 路由和 XR 权限声明 |

## 你负责的网站 / 数据库

1. 创建 Supabase 项目，在 SQL Editor 执行 `supabase/migrations/202610110001_training.sql`。它面向新项目，包含一次性建表语句，不要重复执行。
2. 复制 `.env.example` 为 `.env.local`，填入项目 URL 和 publishable/anon key。**不要使用 service_role、secret key 或数据库密码。**
3. 重新启动 Vite；生产环境设置相同变量后重新构建。
4. 从网站 Create trainee account 注册。如果 Supabase 启用了邮箱验证，先验证邮箱再登录。Auth 设置中的 Site URL / Redirect URLs 应配置为你的实际网站地址。
5. 同一个账号在不同浏览器登录，History 会加载该账号的已同步记录。浏览器断网时，已经登录的页面会把训练保留在本地待同步队列；页面顶部显示状态。全新设备首次登录仍需要网络。
6. 教师不通过注册表单自行选择权限。项目管理员在 SQL Editor 给指定账号设置教师角色，并建立学生分配：

```sql
update public.profiles set role = 'educator' where id = 'TEACHER_AUTH_USER_UUID';
insert into public.educator_assignments(educator_id, trainee_id)
values ('TEACHER_AUTH_USER_UUID', 'TRAINEE_AUTH_USER_UUID');
```

新注册账号默认为 trainee；普通客户端无权修改角色、分配关系或直接写训练表。教师只读被分配的训练记录。管理员角色尚无专用管理 UI。云端不开放网页删除训练历史；Demo 的清除只作用于本地数据。

数据库核心表是 `profiles`、`training_sessions`、`task_results`、`interaction_logs`；另有任务规则表 `scenario_tasks` 和教师授权表 `educator_assignments`。保存 RPC 在事务内验证用户、任务顺序和修订号，按服务器配置的满分及每次错误扣 5 分重新计分。重复或旧修订不会重复追加结果，已结束会话不能再修改。

**数据可信度边界：**任务成功事件仍来自客户端。服务端重新计分和 RLS 可以防止跨账号读写、直接传入任意最终分数，但不能证明物理操作真实发生，不构成防作弊考试系统。

## Unity 队员必须完成的接入

详见 [`docs/UNITY_SETUP.md`](docs/UNITY_SETUP.md)。不要把 `unity-integration` 当成完整 Unity 工程；它没有模型、场景、Packages 或 XR Rig。

1. 在原 Unity 工程安装并验证适配当前 Unity/XRI 版本的 WebXR Export，配置摄像机、左右手柄和真实交互。
2. 将 `unity-integration/Assets/` 合并到工程 Assets；建立名称为 `TrainingEventBridge` 的对象并挂接脚本。
3. 给 `TrainingEventBridge.sceneAdapter` 赋值，把实际任务成功事件连接至 `TrainingScoring.CompleteTask(taskId)`。
4. 使用 WebXR 插件自带模板；按接入文档把网页桥接脚本加到模板，并在 `createUnityInstance` 成功后调用 `TrainingHost.attach(unityInstance)`。保留插件原生 VR 按钮。
5. 导出新构建替换 `public/unity/` 对应资源，保留/重新复制 `training-bridge.js`。
6. 在 HTTPS 上用头显测试：网页开始训练 → Unity 原生 Enter VR → 完成一个任务 → 网页 Checklist 更新 → 完成训练 → 保存云端。

只有 Unity C# 发送 BRIDGE_READY，网页才允许开始 Unity 模式计时。旧构建仅显示 3D，没有桥接时会给出提示，不会伪造任务完成或 VR 支持。

## 会话和恢复规则

- Unity 的 `scenarioId` 必须与网页相同。当前启用的只有 `ladder-inspection`，其余场景仍为未开放状态。
- 新尝试会有新 UUID；重启会把旧尝试保存为 exited，并重新挂载 iframe，保证 Unity 不继续旧场景。
- 每个事件使用稳定的 `eventId`；重传不产生第二次错误扣分。未知任务、错序完成、其他会话和暂停期间的任务事件都会被拒绝。
- 等待加载不计入训练时间。暂停时间不计入总时长。关闭/离开页面时保存暂停状态；强制进程终止可能丢失最后一次写入后的计时，不能保证崩溃前最后一毫秒。
- Unity 默认 `supportsResume=false`。有任务或错误记录的旧场景需要重启；只有实现并测试场景对象状态恢复后才启用此项。Demo 支持保留已完成任务，未完成的逐根梯级选择需重新检查。
- 设置页离开训练会卸载 Unity。网页设置在下一次 START / SETTINGS 传给 Unity，声音已由适配器应用；字幕、移动、坐姿等须由实际场景通过 `onSettingsJson` 接入。
- 一个尝试应在一个浏览器页面中操作。不要在多个标签页同时修改同一活动尝试；服务器修订号防旧覆盖，但未实现多人/多标签页实时状态合并。
- 新版使用 `vr-cache-v2:*` 与旧 Demo localStorage 隔离，不自动把旧未标注数据当成真实训练导入；旧数据未被删除。

## 部署及验收

网站按域名根路径部署（Vite `base: '/'`）。构建后部署 `dist/`，不要双击 HTML 文件打开。Unity 构建文件可能较大，须检查平台单文件限制。当前资源未压缩；未来 Unity 使用 Brotli/Gzip 时需要按实际扩展名设置 Content-Encoding，不能只复制旧配置。

Netlify 风格平台使用 `_headers` / `_redirects`；Vercel 使用 `vercel.json`；其他平台需要等价配置。HTTPS、WebAssembly MIME、资源路由和 XR 权限仍须在实际平台确认。不要把缺失的 Unity 静态资源回退为 SPA HTML。若新构建启用线程，再按 Unity 对该构建的要求配置跨源隔离，不能假设现有配置适用于所有导出。

- [ ] Quest/目标头显 HTTPS 加载成功
- [ ] Unity sceneId 和网站场景相符
- [ ] Unity 原生按钮能进入沉浸模式
- [ ] 头部追踪与左右手柄操作正常
- [ ] 完成任务更新网页 Checklist
- [ ] 错误只扣分一次
- [ ] 暂停阻止实际操作；恢复时计时正确
- [ ] Restart 重置真实模型与网页会话
- [ ] 退出 VR 通知网站并暂停；显式恢复后继续
- [ ] 完成后出现 Feedback，云端显示已同步
- [ ] 换设备同账号看到记录，其他学生看不到
- [ ] 授权教师可见；未授权教师不可见

## 验证范围和参考

具体结果见 [`docs/VALIDATION.md`](docs/VALIDATION.md)。本次没有 Unity 编辑器、原工程、真实 Supabase 项目配置和 VR 头显，因此不声称完成 C# 编译、真实账号跨设备同步或头显验收。

- WebXR Export: https://github.com/De-Panther/unity-webxr-export
- WebXR Export setup: https://de-panther.github.io/unity-webxr-export/Documentation/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

原始项目说明保存在 `docs/README-original.md`，与本说明冲突时以本说明为准。
