import { visit } from "unist-util-visit";

export default function rehypeAddClasses() {
  return (tree) => {
    visit(tree, "element", (node) => {
      node.properties = node.properties || {};
      
      if (node.tagName === "h1") {
        node.properties.className = ["text-4xl font-bold my-6"];
      }
      if (node.tagName === "h2") {
        node.properties.className = ["text-3xl font-semibold my-4"];
      }
      if (node.tagName === "p") {
        node.properties.className = ["text-zinc-300 my-2"];
      }
      if (node.tagName === "ul") {
        node.properties.className = ["list-disc list-inside my-2"];
      }
      if (node.tagName === "table") {
        node.properties.className = [
          "w-full border border-zinc-800 border-collapse text-sm my-6 overflow-hidden rounded-lg"
        ];
      }

      if (node.tagName === "thead") {
        node.properties.className = [
          "bg-zinc-800/80 border-b border-zinc-700"
        ];
      }

      if (node.tagName === "th") {
        node.properties.className = [
          "px-4 py-3 text-left font-semibold text-zinc-200 border-r border-zinc-800 last:border-r-0"
        ];
      }

      if (node.tagName === "tbody") {
        node.properties.className = [
          "divide-y divide-zinc-800"
        ];
      }

      if (node.tagName === "tr") {
        node.properties.className = [
          "even:bg-zinc-800/40 hover:bg-zinc-800/70 transition-colors"
        ];
      }

      if (node.tagName === "td") {
        node.properties.className = [
          "px-4 py-3 text-zinc-300 align-top border-r border-zinc-800 last:border-r-0"
        ];
      }

      if (node.tagName === "code") {
        node.properties.className = [
          "font-mono text-sm bg-zinc-800 px-1.5 py-0.5 rounded"
        ];
      }
    });
  };
}