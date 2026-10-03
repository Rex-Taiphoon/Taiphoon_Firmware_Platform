import { fileTree, type FileNode } from '../shared/file-tree.ts';
export function FileTree({paths,selected,onSelect}: {paths:string[];selected:string;onSelect:(path:string)=>void}) {
  function nodes(items: FileNode[]) {
    return <ul>{items.map(n=><li key={n.path}>{n.children ? <details open><summary>{n.name}/</summary>{nodes(n.children)}</details> : <button type="button" className={selected===n.path?'selected':''} aria-current={selected===n.path?'true':undefined} title={n.path} onClick={()=>onSelect(n.path)}>{n.name}</button>}</li>)}</ul>;
  }
  return <nav className="file-tree" aria-label="Morakot 配置目錄">{nodes(fileTree(paths))}</nav>;
}
