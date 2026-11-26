# pstack for DeepSeek Harness

为 DeepSeek Harness 提供 poteto 工作流，支持任务拆解、多 agent 协作、代码审查和验证。

- 为不同任务角色配置模型和推理强度。
- 支持并行委派、方案比较和交叉审查。
- 可按会话开关，也可默认对新会话启用。

在会话模型菜单中开启 **poteto workflow**；在 **插件 → pstack-dsh** 中配置角色和新会话默认值。

基于 [poteto's pstack](https://github.com/cursor/plugins/tree/main/pstack) 适配。MIT 许可。
