export type FileNode = { name: string; path: string; children?: FileNode[] };
export function fileTree(paths: string[]): FileNode[] {
  const roots: FileNode[] = [];
  for (const path of [...new Set(paths)].sort()) {
    let nodes = roots;
    const parts = path.split('/');
    parts.forEach((name, index) => {
      const full = parts.slice(0,index+1).join('/'), directory = index < parts.length-1;
      let node = nodes.find(n=>n.path===full);
      if (!node) { node={name,path:full,...(directory?{children:[]}: {})}; nodes.push(node); }
      if (directory) nodes=node.children!;
    });
  }
  const sort=(nodes:FileNode[])=>{nodes.sort((a,b)=>Number(Boolean(b.children))-Number(Boolean(a.children))||a.name.localeCompare(b.name));for(const n of nodes)if(n.children)sort(n.children);};
  sort(roots);return roots;
}
