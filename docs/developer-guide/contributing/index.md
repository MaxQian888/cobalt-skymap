# 贡献指南

感谢您对 Cobalt Skymap 项目的关注！我们欢迎各种形式的贡献。

## 贡献方式

### 报告问题

发现问题？请创建 Issue：

1. 访问 [GitHub Issues](https://github.com/ElementAstro/cobalt-skymap/issues/new)
2. 搜索是否已有相同问题
3. 如果没有，创建新 Issue
4. 详细描述问题
5. 如有需要，附上应用内导出的诊断包（手动上传附件）

**好的 Issue 模板**：

```markdown
## 问题描述
简要描述遇到的问题

## 复现步骤
1. 打开应用
2. 点击"xxx"
3. 看到"yyy"

## 预期行为
应该发生什么

## 实际行为
实际发生了什么

## 环境
- 操作系统: Windows 11
- 应用版本: 0.1.0
- 浏览器（如适用）: Chrome 120

## 截图
如有必要，添加截图说明问题
```

### 提交代码

#### 开发流程

1. **Fork 项目**

```bash
# 在 GitHub 上 Fork 项目
git clone https://github.com/ElementAstro/cobalt-skymap.git
cd cobalt-skymap
git remote add upstream https://github.com/ElementAstro/cobalt-skymap.git
```

2. **创建分支**

```bash
# 同步主分支
git checkout main
git pull upstream main

# 创建功能分支
git checkout -b feature/my-awesome-feature
```

3. **进行开发**

- 编写代码
- 添加测试
- 更新文档
- 遵循代码规范

4. **提交代码**

```bash
# 查看变更
git status

# 添加文件
git add .

# 提交（使用约定式提交）
git commit -m "feat: add awesome feature"
```

5. **推送分支**

```bash
git push origin feature/my-awesome-feature
```

6. **创建 Pull Request**

- 访问 GitHub
- 点击 "New Pull Request"
- 填写 PR 模板
- 等待审查

### 改进文档

文档同样重要！您可以通过以下方式贡献文档：

1. 改进现有文档
2. 添加缺失的文档
3. 修正错误
4. 添加示例代码

### 帮助他人

- 回答其他用户的问题
- 审查 Pull Request
- 分享使用经验

## 代码规范

### 代码风格

#### TypeScript/React

- 使用 TypeScript 类型
- 组件使用 PascalCase
- 函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 组件文件：kebab-case.tsx
- 使用 `createLogger()` 替代 `console.*`

```typescript
// 好的示例
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ variant = 'primary', onClick }: ButtonProps) {
  return (
    <button className={variant} onClick={onClick}>
      Click me
    </button>
  );
}
```

#### Rust

- 使用 rustfmt 格式化
- 遵循 Rust 命名规范
- 添加必要的注释
- 处理错误

```rust
// 好的示例
#[tauri::command]
async fn get_object_info(object_id: String) -> Result<ObjectInfo, String> {
    if object_id.is_empty() {
        return Err("Object ID cannot be empty".to_string());
    }

    let info = fetch_object_info(&object_id).await?;
    Ok(info)
}
```

### 提交消息规范

使用约定式提交（Conventional Commits）：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

#### 示例

```bash
feat(starmap): add search functionality

Add ability to search for celestial objects by name.
Implemented search bar and result display.

Closes #123
```

## 测试要求

### 单元测试

为新功能添加单元测试：

```typescript
// __tests__/utils.test.ts
import { calculateFOV } from '@/lib/utils';

describe('calculateFOV', () => {
  it('calculates field of view correctly', () => {
    const telescope = { focalLength: 2000, aperture: 200 };
    const camera = { sensorWidth: 23.2, focalLength: 50 };

    const fov = calculateFOV(telescope, camera);

    expect(fov.horizontal).toBeCloseTo(1.32, 2);
  });
});
```

### 测试覆盖率

项目覆盖率门槛：

- Branches: 50%
- Functions: 35%
- Lines: 60%
- Statements: 60%

```bash
# 运行测试并生成覆盖率报告
pnpm test:coverage
```

## Pull Request 指南

### PR 标题

使用清晰的标题：

```markdown
## PR 标题格式

[type] Brief description of changes

例如：
[Feature] Add object search functionality
[Fix] Resolve crash when loading large catalogs
[Docs] Update installation guide
```

### PR 描述

提供详细的 PR 描述：

```markdown
## 变更说明
简要说明此 PR 的内容和目的

## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 代码重构
- [ ] 文档更新
- [ ] 性能优化

## 测试
描述如何测试这些变更

- [ ] 单元测试通过
- [ ] 手动测试通过
- [ ] 添加了新测试

## 截图
如适用，添加截图展示变更

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 已添加必要的文档
- [ ] 已更新相关文档
- [ ] 所有测试通过
- [ ] 无 ESLint/Clippy 警告
```

### 审查流程

1. **自动检查**: CI 会自动运行测试
2. **代码审查**: 维护者会审查代码
3. **反馈**: 可能会请求修改
4. **合并**: 通过后合并到主分支

## 开发规范

### 前端开发

#### 组件开发

- 使用函数组件 + Hooks
- 避免过度优化
- 保持组件小而专注

```typescript
// 好的组件
export function ObjectCard({ object }: { object: ObjectInfo }) {
  return (
    <Card>
      <CardHeader>{object.name}</CardHeader>
      <CardContent>{object.description}</CardContent>
    </Card>
  );
}
```

#### 状态管理

- 合理使用 Zustand store
- 避免过度状态提升
- 使用派生状态

```typescript
// 好的状态管理
const useObjectData = (objectId: string) => {
  const data = useObjectStore(state => state.objects[objectId]);
  const fetchObject = useObjectStore(state => state.fetchObject);

  useEffect(() => {
    if (!data) {
      fetchObject(objectId);
    }
  }, [objectId, data, fetchObject]);

  return data;
};
```

### 后端开发

#### Tauri 命令

- 使用 Result 类型
- 提供清晰的错误信息
- 验证输入参数

```rust
// 好的命令
#[tauri::command]
async fn add_telescope(
    name: String,
    aperture: u32,
    focal_length: u32
) -> Result<Telescope, String> {
    if name.trim().is_empty() {
        return Err("Name cannot be empty".to_string());
    }

    if aperture == 0 || focal_length == 0 {
        return Err("Aperture and focal length must be positive".to_string());
    }

    let telescope = Telescope::new(name, aperture, focal_length);
    save_telescope(&telescope).await?;

    Ok(telescope)
}
```

#### 错误处理

- 使用 Result 类型
- 提供有用的错误消息
- 记录错误日志

```rust
// 好的错误处理
#[tauri::command]
async fn load_data(id: String) -> Result<Data, String> {
    match database::load(&id).await {
        Ok(data) => Ok(data),
        Err(e) => {
            log::error!("Failed to load data {}: {}", id, e);
            Err(format!("Failed to load data: {}", e))
        }
    }
}
```

## 文档规范

### 代码注释

- 解释「为什么」而不是「是什么」
- 注释复杂的算法
- 记录重要的决策

```typescript
/**
 * 计算望远镜的视野范围
 *
 * 考虑了大气折射对地平线附近目标的影响。
 * 使用简化的折射模型（Bennett 1982）。
 *
 * @param telescope - 望远镜配置
 * @param camera - 相机配置
 * @returns FOV 信息（水平和垂直角度）
 */
function calculateFOV(telescope: Telescope, camera: Camera): FOVInfo {
  // 实现
}
```

### README 和文档

- 更新 README 说明新功能
- 添加使用示例
- 更新 CHANGELOG
- 添加必要的文档

## 行为准则

### 尊重和包容

- 使用友好和尊重的语言
- 欢迎不同背景的贡献者
- 建设性反馈
- 避免人身攻击

### 沟通

- 清晰表达想法
- 接受反馈
- 寻求帮助
- 分享知识

## 发布流程

### 版本号

使用语义化版本（Semantic Versioning）：

```
MAJOR.MINOR.PATCH

例如：0.1.0
- MAJOR: 不兼容的 API 变更
- MINOR: 向后兼容的功能新增
- PATCH: 向后兼容的 Bug 修复
```

### 发布检查清单

- [ ] 所有测试通过
- [ ] 更新版本号
- [ ] 更新 CHANGELOG
- [ ] 更新文档
- [ ] 创建 Git 标签
- [ ] 构建发布包
- [ ] 测试发布包
- [ ] 发布 Release

## 获取帮助

### 资源

- [项目文档](../index.md)
- [API 参考](../apis/index.md)
- [架构设计](../architecture/index.md)

### 联系方式

- GitHub Issues: 技术问题
- GitHub Discussions: 一般讨论

## 认可贡献者

我们会在以下地方认可贡献者：

- [Contributors](https://github.com/ElementAstro/cobalt-skymap/graphs/contributors) 页面
- Release Notes 中

## 许可证

通过贡献代码，您同意您的贡献将在与项目相同的 [MIT License](LICENSE) 下发布。

---

感谢您的贡献！一起让 Cobalt Skymap 变得更好！

返回：[开发指南](../index.md)
