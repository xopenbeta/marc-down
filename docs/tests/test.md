# mdast vs satteri 性能对比

测试文件：`test_963k.md`，大小 937.8 KB（960256 bytes，约3万行），多次运行取平均。

| 指标 | mdast (老牌md解析器) | satteri (用Rust写的md解析器) |
| --- | --- | --- |
| 平均耗时 | 1003.37 ms | 9.43 ms |
| 节点数 | 54785 | 64001 |
