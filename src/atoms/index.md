# atoms/index.ts

## 作用

统一导出所有 Jotai atom，作为状态层的公共入口。

## 为什么这么实现

- 桶文件（barrel file）让消费方只需 `import { xxx } from "@/atoms"` 即可访问任意 atom，降低导入路径耦合
- atom 按职责拆分为独立文件（workspace、fileTree、editor、outline、search），避免单文件膨胀，同时通过此文件统一对外暴露
