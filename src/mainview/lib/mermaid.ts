import mermaid from 'mermaid';

// mermaid keeps its config in a global, and concurrent render() calls can step
// on each other. Run renders one at a time, each with the theme it asked for.
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

export function renderMermaid(source: string, dark: boolean): Promise<string> {
  const run = async () => {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose',
    });
    const { svg } = await mermaid.render(`mermaid-svg-${counter++}`, source);
    return svg;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
