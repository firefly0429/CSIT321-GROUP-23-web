# Unity 成员接入说明

## 场景配置

原始 Unity 工程不在本次 ZIP 内。以下文件是可导入的集成代码，不会自动生成 XR Rig、控制器抓取、工业模型或安全判定。

1. 合并 `unity-integration/Assets` 到工程 `Assets`。
2. 建立空对象 `TrainingEventBridge`，挂 `TrainingEventBridge`、`TrainingSceneAdapter`、`TrainingScoring`、`WebXRTrainingManager`。
3. Inspector 引用：Bridge.sceneAdapter → 适配器；Scoring.bridge 和 Manager.bridge → Bridge。
4. `scenarioId` 当前设为 `ladder-inspection`。如果实际做的是机器操作而非梯子检查，需要同时修改网页场景、任务 ID、评分脚本及 SQL 任务目录/RPC；不要把不相干动作映射成梯子任务。
5. Adapter.onReset 连接 Scoring.ResetProgress，并连接你自己的模型复位方法。Adapter.onPaused(bool) 连接所有任务交互脚本的启停逻辑，尤其是使用 unscaledDeltaTime 的逻辑。仅 Time.timeScale=0 不能保证所有 XR 输入被禁用。
6. 将以下事件连到 Scoring.CompleteTask(string)。错误操作连到 Scoring.RecordCurrentMistake()。只有真实成功检测才触发，不要每帧重复触发。

| taskId | 实际判定 |
| --- | --- |
| inspect-area | 地面危险物已经移至安全位置 |
| wear-equipment | 安全帽已经正确佩戴 |
| secure-ladder | 左右固定装置都已锁好 |
| inspect-rungs | 五根梯级全部检查且损坏梯级判断正确 |
| confirm-inspection | 用户确认完整检查 |

最后一个任务完成后 Scoring 自动发送 SESSION_FINISHED。需要其他场景时更改 Scoring 的顺序数组及网站/数据库规则。

## 模板接入（不要覆盖 WebXR 插件自己的初始化）

安装与项目 Unity/XRI 版本匹配的 WebXR Export 后，先按该插件文档独立验证场景能进入 VR，再把桥接叠加到它的模板。

将 `public/unity/training-bridge.js` 复制进选用的模板，在 loader 前添加：

```html
<div id="training-status" role="status"></div>
<div id="xr-status" role="status"></div>
<script src="training-bridge.js"></script>
```

在已有的加载成功回调中追加一行，不要删掉插件原来的回调内容：

```js
createUnityInstance(canvas, config, onProgress).then((unityInstance) => {
  // 保留 WebXR 模板已有的初始化和 VR/AR 按钮绑定。
  window.TrainingHost.attach(unityInstance);
}).catch((error) => window.TrainingHost.fail(String(error)));
```

插件原生 Enter VR 按钮负责在用户点击时申请 XR session。React 不异步请求 VR，也不创建一个脱离 Unity 渲染的空 XR session。当前原始 WebGL 模板只有全屏按钮；需要换成真正 WebXR 模板后才会有相应能力。

把你所安装版本的 WebXR 状态变化回调连至 `WebXRTrainingManager.OnEnterVR()` / `OnExitVR()`。如插件只提供 C# static event，则写一个小的版本适配脚本订阅该事件，再调用这两个公开方法，并在 OnDisable 取消订阅。这里刻意不假设某个插件版本的事件签名。头显内暂停菜单调用 `OnHeadsetPause()`；恢复可从网页 Resume，若要头显内恢复菜单，需增加双方确认的对应协议后接入。

导出后确认 `training-bridge.js`、`.jslib` 导出的调用和 C# 脚本确实包含在新构建里。先测试 `/unity/index.html` 的加载和 VR，再测试嵌入网页；独立页不绑定用户会话、不保存网站成绩。

## 恢复及设置

`supportsResume` 默认关闭。需要继续训练时：

- onRestoreJson 连接 Scoring.RestoreProgress(string)。
- 另外连接你自己的 RestoreScene(string)，按快照中的 taskResults 恢复模型位置、头盔、两侧锁、梯级检查状态等。
- 实际验证完成后才能开启 supportsResume。仅恢复评分 HashSet 不等于恢复整个场景。

onSettingsJson 接收 `subtitles`、`highContrast`、`textSize`、`movementMode`、`postureMode`、`reducedMotion`、`soundEnabled`。声音通过 AudioListener.volume 实现，其余要由已有 UI/XR 移动组件应用，不能把发出设置当成设置已经生效。

## 协议

所有 postMessage 都使用同源地址，接收端检查发送 Window。消息外壳为：

```json
{
  "channel": "csit321-training",
  "version": 1,
  "type": "TASK_COMPLETED",
  "sessionId": "当前尝试的 UUID",
  "scenarioId": "ladder-inspection",
  "eventId": "该动作的稳定 UUID",
  "timestamp": "2026-10-11T07:00:00Z",
  "taskId": "inspect-area"
}
```

- 初始化：React HELLO → JS PLAYER_STATUS；Unity C# BRIDGE_READY → JS integrated=true。
- 命令：START、PAUSE、RESUME、EXIT、SETTINGS。START 附完整 session 快照与 settings。每条命令都有 commandId，等待 COMMAND_ACK；最多发 5 次。
- 事件：TASK_COMPLETED、MISTAKE、SESSION_FINISHED、XR_CHANGED、PAUSED。事件持久化成功后网页发 EVENT_ACK。
- Unity 宿主 JS 重发未确认事件，重复消息保持原 eventId。明确拒绝的事件停止重传并暂停 Unity，网页展示拒绝原因。
- Unity 场景内不得持有 Supabase 密钥、用户密码或用户 access token，只有网页 SDK 处理认证。

## 注意

重新开始采用结束旧会话并重建 iframe；未收到 EXIT 确认时，iframe 卸载作为最终停止手段。刷新后有进度但未配置恢复的场景，网页会要求重启。WebXR 兼容与手柄操作必须在真实设备上检查，C# 模板不能替代该验收。
