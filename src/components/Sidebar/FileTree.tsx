import { useState, useMemo, useCallback } from "react";
import { FileTreeNode } from "./FileTreeNode";
import { FileContextMenu } from "./FileContextMenu";
import { readDirectoryChildren } from "@/utils/tauriFs";
import type { FileNode } from "@/types";

interface FileTreeProps {
  node: FileNode;
}

interface FlatItem {
  node: FileNode;
  level: number;
}

function flattenTree(
  node: FileNode,
  level: number,
  expandedPaths: Set<string>
): FlatItem[] {
  const items: FlatItem[] = [];
  if (!node.children) return items;

  for (const child of node.children) {
    items.push({ node: child, level });
    if (child.is_directory && expandedPaths.has(child.path) && child.children) {
      items.push(...flattenTree(child, level + 1, expandedPaths));
    }
  }
  return items;
}

function insertChildren(
  root: FileNode,
  targetPath: string,
  children: FileNode[]
): FileNode {
  if (root.path === targetPath) {
    return { ...root, children };
  }
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((child) =>
      child.is_directory ? insertChildren(child, targetPath, children) : child
    ),
  };
}

interface ContextMenuState {
  node?: FileNode;
  dirPath: string;
  x: number;
  y: number;
}

export function FileTree({ node: initialNode }: FileTreeProps) {
  const [treeData, setTreeData] = useState<FileNode>(initialNode);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useMemo(() => {
    let root = initialNode;
    setTreeData(root);

    // 刷新后重新加载已展开文件夹的子项
    expandedPaths.forEach((path) => {
      readDirectoryChildren(path).then((children) => {
        setTreeData((prev) => insertChildren(prev, path, children));
      });
    });
  }, [initialNode]);

  const flatItems = useMemo(
    () => flattenTree(treeData, 1, expandedPaths),
    [treeData, expandedPaths]
  );

  const toggleExpand = useCallback(async (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      next.add(path);
      return next;
    });

    setTreeData((current) => {
      const target = findNode(current, path);
      if (target && target.children === null) {
        readDirectoryChildren(path).then((children) => {
          setTreeData((prev) => insertChildren(prev, path, children));
        });
      }
      return current;
    });
  }, []);

  const handleContextMenu = useCallback((node: FileNode, x: number, y: number) => {
    const dirPath = node.is_directory
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf("/"));
    setContextMenu({ node, dirPath, x, y });
  }, []);

  const handleBlankContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        setContextMenu({ dirPath: treeData.path, x: e.clientX, y: e.clientY });
      }
    },
    [treeData.path]
  );

  return (
    <div
      onContextMenu={handleBlankContextMenu}
      style={{ minHeight: "100%", height: "100%" }}
    >
      {flatItems.map((item) => (
        <FileTreeNode
          key={item.node.path}
          node={item.node}
          level={item.level}
          isCollapsed={item.node.is_directory && !expandedPaths.has(item.node.path)}
          onToggleCollapse={toggleExpand}
          onContextMenu={handleContextMenu}
        />
      ))}
      {contextMenu && (
        <FileContextMenu
          node={contextMenu.node}
          dirPath={contextMenu.dirPath}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function findNode(root: FileNode, path: string): FileNode | null {
  if (root.path === path) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}
